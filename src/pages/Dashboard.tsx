import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Plus, LogOut, User, Calendar, Clock, Copy, Share, Link } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { v4 as uuidv4 } from 'uuid';

const Dashboard: React.FC = () => {
  const [roomId, setRoomId] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedRoomId, setGeneratedRoomId] = useState('');
  const [copied, setCopied] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  const handleCreateRoom = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const newRoomId = uuidv4().substring(0, 8);
    console.log('Creating room:', newRoomId);
    navigate(`/room/${newRoomId}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (roomId.trim()) {
      console.log('Joining room:', roomId.trim());
      navigate(`/room/${roomId.trim()}`);
    }
  };

  const handleQuickStart = () => {
    if (!user) {
      navigate('/login');
      return;
    }
    const quickRoomId = `quick-${Date.now()}`;
    console.log('Quick starting room:', quickRoomId);
    navigate(`/room/${quickRoomId}`);
  };

  const handleGenerateLink = () => {
    const newRoomId = uuidv4().substring(0, 8);
    setGeneratedRoomId(newRoomId);
    setShowShareModal(true);
  };

  const handleCopyLink = async () => {
    const roomLink = `${window.location.origin}/room/${generatedRoomId}`;
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = roomLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGeneratedMeeting = () => {
    setShowShareModal(false);
    navigate(`/room/${generatedRoomId}`);
  };

  const mockMeetings = [
    {
      id: '1',
      title: 'Team Standup',
      time: '10:00 AM',
      participants: 5,
      roomId: 'standup-123'
    },
    {
      id: '2',
      title: 'Client Meeting',
      time: '2:00 PM',
      participants: 3,
      roomId: 'client-456'
    }
  ];

  // Show loading or redirect if no user
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-white" />
          </div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Video className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">VideoCall Pro</h1>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <span className="text-gray-700 font-medium">{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Welcome Section */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Welcome back, {user?.name}!
              </h2>
              <p className="text-gray-600 mb-6">
                Start a new meeting or join an existing one
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* New Meeting */}
                <button
                  onClick={handleCreateRoom}
                  className="p-6 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 group transform hover:scale-105"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Plus className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-semibold">New Meeting</span>
                  </div>
                  <p className="text-blue-100 text-sm">Start an instant meeting</p>
                </button>

                {/* Generate Link */}
                <button
                  onClick={handleGenerateLink}
                  className="p-6 bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl hover:from-green-600 hover:to-teal-700 transition-all duration-200 group transform hover:scale-105"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Share className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-semibold">Generate Link</span>
                  </div>
                  <p className="text-green-100 text-sm">Create a shareable link</p>
                </button>

                {/* Quick Start */}
                <button
                  onClick={handleQuickStart}
                  className="p-6 bg-white border-2 border-gray-200 hover:border-blue-300 rounded-xl transition-all duration-200 group transform hover:scale-105"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <Video className="w-6 h-6 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="text-lg font-semibold text-gray-900">Quick Start</span>
                  </div>
                  <p className="text-gray-600 text-sm">Jump into a meeting now</p>
                </button>
              </div>
            </div>

            {/* Join Meeting */}
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Join a Meeting</h3>
              <form onSubmit={handleJoinRoom} className="flex gap-4">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Enter meeting ID or paste meeting link"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
                >
                  Join
                </button>
              </form>
              <p className="text-sm text-gray-500 mt-2">
                You can paste a full meeting link or just enter the meeting ID
              </p>
            </div>
          </div>

          {/* Right Column - Recent Meetings */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Today's Schedule</h3>
              <div className="space-y-4">
                {mockMeetings.map((meeting) => (
                  <div key={meeting.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-gray-900">{meeting.title}</h4>
                      <button className="text-gray-400 hover:text-gray-600">
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {meeting.time}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {meeting.participants}
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(`/room/${meeting.roomId}`)}
                      className="mt-3 w-full py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      Join Meeting
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Meetings Today</span>
                  <span className="font-semibold text-gray-900">2</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Duration</span>
                  <span className="font-semibold text-gray-900">1h 30m</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Participants</span>
                  <span className="font-semibold text-gray-900">8</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4">Share Meeting Link</h3>
            <p className="text-gray-600 mb-4">
              Share this link with others to invite them to your meeting:
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Link className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Meeting Link:</span>
              </div>
              <div className="bg-white rounded border p-2 text-sm font-mono break-all">
                {`${window.location.origin}/room/${generatedRoomId}`}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-blue-700">Meeting ID:</span>
              </div>
              <div className="text-lg font-bold text-blue-900">{generatedRoomId}</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCopyLink}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                  copied 
                    ? 'bg-green-500 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {copied ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={handleStartGeneratedMeeting}
                className="flex-1 py-3 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium transition-colors"
              >
                Start Meeting
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;