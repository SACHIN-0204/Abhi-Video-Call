import React, { useContext, useState } from 'react';
import withAuth from '../utils/withAuth'
import { useNavigate } from 'react-router-dom';
import "../App.css";
import { IconButton, Button, TextField } from '@mui/material';
import RestoreIcon from "@mui/icons-material/Restore";
import { AuthContext } from '../contexts/AuthContext';

function HomeComponent() {

    let navigate = useNavigate();
    const [meetingCode, setMeetingCode] = useState("");

    const {addToUserHistory} = useContext(AuthContext);
    let handleJoinVideoCall = async () => {
        try {
            await addToUserHistory(meetingCode);
            navigate(`/${meetingCode}`);
        } catch (error) {
            if (error.response?.status === 401) {
                localStorage.removeItem("token");
                navigate("/auth");
            }
        }
    }

    return (
        <>
        <div className='navbar'>
           
           <div style={{display: "flex", alignItems: "center"}}>

                <h2>Abhi Vide Call</h2>

           </div>

           <div style={{display: "flex", alignItems: "center"}}>

                <IconButton onClick={
                    () => {
                        navigate("/history")
                    }
                }>
                    <RestoreIcon/>
                </IconButton>
                <p>History</p>
                <Button onClick={() => {
                    localStorage.removeItem("token")
                    navigate("/auth")
                }}>
                    Logout
                </Button>

           </div>

           

        </div>

        <div className="meetContainer">
            <div className="leftPanel">
                <h2>Providing Quality Video Call Just Like Qyality Education</h2>
                <div style={{display: "flex", gap: "10px"}}>
                    <TextField onChange={e => setMeetingCode(e.target.value)} id="outlined-basic" label="Meeting" variant='outlined'></TextField>
                    <Button onClick={handleJoinVideoCall} variant='contained'>Join</Button>
                </div>
            </div>

            <div className='rightPanel'>
                  <img srcSet='/logo3.png' alt=""/>
            </div>

        </div>
        </>
    )
}

export default withAuth(HomeComponent);