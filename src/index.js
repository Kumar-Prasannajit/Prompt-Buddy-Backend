import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/db-connection.js"

dotenv.config({
    path: "./.env"
})

const PORT = process.env.PORT || 3000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server is running at http://localhost:${PORT}`)
        })
    })
    .catch((error) => {
        console.log("MongoDB connection failed", error)
        process.exit(1)
    })
