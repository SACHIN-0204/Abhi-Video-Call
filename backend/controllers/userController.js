import httpStatus from "http-status";
import {User} from "../models/userModel.js";
import {Meeting} from "../models/meetingModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";

const login = async (req, res) => {
     const { username, password } = req.body || {};

     if (!username || !password) {
          return res.status(400).json({ message: "Please provide username and password" });
     }

     try {
          const user = await User.findOne({ username });
          if (!user) {
               return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
          }

          const passwordMatches = await bcrypt.compare(password, user.password);
          if (!passwordMatches) {
               return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid credentials" });
          }

          const token = crypto.randomBytes(20).toString("hex");
          user.token = token;
          await user.save();

          return res.status(httpStatus.OK).json({ token });
     } catch (error) {
           return res.status(500).json({ message: `Something went wrong ${error}` });
     }
};

const register = async (req, res) => {
     const { name, username, password } = req.body || {};

     if (!name || !username || !password) {
          return res.status(400).json({ message: "Please provide name, username, and password" });
     }

     try {
       const existingUser = await User.findOne({ username });
       if (existingUser) {
          return res.status(httpStatus.FOUND).json({ message: "User already exists" });
       }

       const hashedPassword = await bcrypt.hash(password, 10);

       const newUser = new User({
          name,
          username,
          password: hashedPassword,
       });
       
       await newUser.save();

       res.status(httpStatus.CREATED).json({ message: "User registered" });
     } catch (error) {
          res.status(500).json({ message: `Something went wrong ${error}` });
     }
};

const getUserHistory = async (req, res) => {
     const {token} = req.query;

     try {

          const user = await User.findOne({token: token});
          if (!user) {
               return res.status(httpStatus.UNAUTHORIZED).json({message: "Invalid or expired token"});
          }

          const meetings = await Meeting.find({user_id: user.username});
          res.json(meetings);

     } catch(err) {
          res.json({message: `Something went wrong ${err}`});
     }
}

const addToHistory = async (req, res) => {
     const {token, meeting_code} = req.body;

     try {
        const user = await User.findOne({token: token});
            if (!user) {
                 return res.status(httpStatus.UNAUTHORIZED).json({message: "Invalid or expired token"});
            }

        const newMeeting = new Meeting({
          user_id: user.username,
          meetingCode: meeting_code
        })

        await newMeeting.save();

        res.status(httpStatus.CREATED).json({message: "Added code to history"})

     } catch(err) {
        res.json({message: `Something went wrong ${err}`});
     }
}

export {login, register, getUserHistory, addToHistory};