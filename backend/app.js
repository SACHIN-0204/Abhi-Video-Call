import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectToSocket } from "./controllers/socketManager.js";
import cors from "cors";
import userRoutes from "./routes/usersroutes.js";


const app = express();
const server = createServer(app);
const io = connectToSocket(server);

app.set("port", (process.env.PORT || 8000));
app.use(cors());
app.use(express.json({limit: "40kb"}));
app.use(express.urlencoded({limit: "40kb", extended: true}));
app.use("/api/v1/users", userRoutes);



app.get("/home", (req, res) => {
    return res.json({"hello":"world"});
});

const start = async () => {
    const connectionDB = await mongoose.connect("mongodb+srv://VideoConference:videoconference@cluster0.ofemiis.mongodb.net/VideoConference");
    console.log(`MONGO Connected DB Host: ${connectionDB.connection.host}`);
     server.listen(app.get("port"), () => {
        console.log("Listening on port 8000");
     })
}

start();