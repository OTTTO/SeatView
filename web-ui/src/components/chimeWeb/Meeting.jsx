import React, { Component } from 'react';
import { withRouter } from 'react-router-dom';
import PropTypes from 'prop-types';
import * as config from '../../config';

import {
  MeetingSessionStatusCode
} from 'amazon-chime-sdk-js';

// Components
import Chat from '../chat/Chat';
import Controls from './Controls';
import Settings from './Settings';
import LocalVideo from './LocalVideo';
import RemoteVideoGroup from './RemoteVideoGroup';
import Error from './Error';

// Styles
import './ChimeWeb.css';

class Meeting extends Component {

  state = {
    meetingStatus: null, // Loading, Success or Failed
    showSettings: false,

    showError: false,
    errorMsg: '',
  }

  constructor() {
    super();

    this.baseHref = config.BASE_HREF;
    this.ssName = '';

    this.audioElementRef = React.createRef();
    this.myVideoElement = React.createRef();
  }

  componentDidMount() {

    const start = async () => {
      try {

        const qs = new URLSearchParams(this.props.location.search);
        const room = qs.get('room');
        this.ssName = `chime[${room}]`;
        if (!room || !sessionStorage.getItem(this.ssName)) {
          this.props.history.push(`${this.baseHref}/`);
        }

        const ssData = JSON.parse(sessionStorage.getItem(this.ssName));
        if (config.DEBUG) console.log(ssData);

        this.username = ssData.username;
        this.title = ssData.title;
        this.role = ssData.role;
        //console.log("ROLE: " + this.role);

        if (!ssData.joinInfo) {

          this.joinInfo = await this.props.chime.createRoom(this.role, this.username, this.title);          
          const data = {
            ...ssData,
            joinInfo: this.joinInfo
          }
          console.log(data);
          sessionStorage.setItem(this.ssName, JSON.stringify(data));
          this.playbackURL = this.joinInfo.PlaybackURL;
        } else {
          // Browser refresh
          this.joinInfo = ssData.joinInfo;
          this.playbackURL = ssData.joinInfo.PlaybackURL;
          await this.props.chime.reInitializeMeetingSession(this.joinInfo, this.username);
        }

        this.setState({ meetingStatus: 'Success' });

        this.props.chime.audioVideo.addObserver({
          audioVideoDidStop: async (sessionStatus) => {
            if (sessionStatus.statusCode() === MeetingSessionStatusCode.AudioCallEnded) {
              const whereTo = `${this.baseHref}/${this.role === 'host' ? '' : 'end'}`;
              this.props.chime.leaveRoom(this.role === 'host')              
              this.props.history.push(whereTo);
            }
          }
        });

        await this.props.chime.joinRoom(this.audioElementRef.current);
      } catch (error) {
        // eslint-disable-next-line
        console.error(error);
        this.setState({ meetingStatus: 'Failed' });
      }
    };
    start();
    console.log(this.joinInfo)
  }

  /*
   * Settings
   */

  openSettings = () => {
    this.setState({ showSettings: true });
  }

  closeSettings = () => {
    this.setState({ showSettings: false });
  }

  handleClick = (e) => {
    const { showSettings } = this.state;
    if (showSettings) {
      let node = e.target;
      let isModal = false;
      while (node) {
        if (node && node.classList && node.classList.contains('modal__el')) {
          isModal = true;
          break;
        }
        node = node.parentNode;
      }
      if (!isModal) {
        this.setState({ showSettings: false });
      }
    }
  }

  saveSettings = (playbackURL, currentAudioInputDevice, currentAudioOutputDevice, currentVideoInputDevice) => {
    this.setState({
      showSettings: false,
      currentAudioInputDevice,
      currentAudioOutputDevice,
      currentVideoInputDevice
    });
  }

  setMetadataId = (metadataId) => {
    this.setState({ metadataId });
  }

  setErrorMsg = errorMsg => {
    this.setState({ errorMsg, showError: true });
  }

  closeError = () => {
    this.setState({ showError: false });
  }

  layout = () => {
    if(this.state.meetingStatus !== 'Success') {
      return;
    }
  //{this.joinInfo.Attendee.ExternalUserId === this.joinInfo.HostId ? : }
  /*
  <VideoPlayer
    setMetadataId={this.setMetadataId}
    videoStream={this.playbackURL}
  />
  */
    return (
      <div className="app-grid" onClick={this.handleClick}>
        <div className="main-stage">
          <div className="cams pos-relative">
          <LocalVideo
            chime={this.props.chime}
            joinInfo={this.joinInfo}
          />
          {this.joinInfo.Attendee.AttendeeId !== this.joinInfo.Meeting.HostId ? 
          <RemoteVideoGroup
            chime={this.props.chime}
            joinInfo={this.joinInfo}
            top={true}
          /> : ''}
          </div>          
          <RemoteVideoGroup
            chime={this.props.chime}
            joinInfo={this.joinInfo}
            top={false}
         />
          <Controls
            chime={this.props.chime}
            baseHref={this.baseHref}
            ssName={this.ssName}
            title={this.title}
            openSettings={this.openSettings}
            role={this.joinInfo.Attendee.AttendeeId === this.joinInfo.Meeting.HostId ? 'host' : 'attendee'}
            history={this.props.history}
            myVideoElement={this.myVideoElement}
          />
        </div>
        <Chat
          chime={this.props.chime}
          title={this.title}
          username={this.username}
          joinInfo={this.joinInfo}
        />
        {this.state.showSettings && (
          <Settings
            chime={this.props.chime}
            joinInfo={this.joinInfo}
            saveSettings={this.saveSettings}
          />
        )}
      </div>
    )
  }

  render() {
    return (
      <React.Fragment>

        <audio ref={this.audioElementRef} style={{ display: 'none' }} />

        {this.layout()}

        {this.state.showError && (
          <Error
            closeError={this.closeError}
            errorMsg={this.state.errorMsg}
          />
        )}
      </React.Fragment>
    )
  }
}

Meeting.propTypes = {
  chime: PropTypes.object
};

export default withRouter(Meeting);
