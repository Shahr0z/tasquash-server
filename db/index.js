import mongoose from "mongoose";

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri || typeof uri !== "string" || uri.trim() === "") {
        console.error(
            "MONGODB connection FAILED: MONGODB_URI is missing or empty in .env"
        );
        throw new Error(
            "MONGODB_URI is missing or empty. Add MONGODB_URI to .env (e.g. mongodb://localhost:27017/tasquash or mongodb+srv://user:pass@cluster.mongodb.net/dbname)"
        );
    }

    const validScheme = uri.trim().startsWith("mongodb://") || uri.trim().startsWith("mongodb+srv://");
    if (!validScheme) {
        console.error(
            "MONGODB connection FAILED: MONGODB_URI must start with mongodb:// or mongodb+srv://"
        );
        throw new Error(
            "MONGODB_URI must start with mongodb:// or mongodb+srv://"
        );
    }

    const isVercel = !!process.env.VERCEL;
    const options = {
        serverSelectionTimeoutMS: isVercel ? 6000 : 10000,
        connectTimeoutMS: isVercel ? 6000 : 10000,
    };

    try {
        const connectionInstance = await mongoose.connect(uri, options);
        console.log(
            `MongoDB is Hosted !! on : ${connectionInstance.connection.host}`
        );
    } catch (error) {
        console.error("MONGODB connection FAILED : ", error);
        throw error;
    }
};

export default connectDB;