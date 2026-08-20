import React from 'react';
import LandingPage from './pages/landing';
import { BrowserRouter as Router, Routes, Route} from "react-router-dom";
import './App.css';
import Authentication from './pages/authentication';
import { AuthProvider } from './contexts/AuthContext';
import VideoMeetComponent from './pages/VideoMeet';
import HomeComponent from './pages/Home';
import History from './pages/history';

function App() {
  return (
     <>
     <Router>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<Authentication />} />
          <Route path="/home" element={<HomeComponent />} />
          <Route path="/history" element={<History />} />
          <Route path="/:url" element={<VideoMeetComponent />} /> 
        </Routes>
      </AuthProvider>
     </Router>
     </>
  );
}

export default App;
