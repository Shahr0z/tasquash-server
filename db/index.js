import mongoose from "mongoose";

const connectDB = async () => {
    const uri = process.env.MONGODB_URI;

    if (!uri || typeof uri !== "string" || uri.trim() === "") {
        console.error(
            "MONGODB connection FAILED: MONGODB_URI is missing or empty in .env"
        );
        console.error(
            "Add to your .env: MONGODB_URI=mongodb://localhost:27017/tasquash"
        );
        console.error(
            "Or for Atlas: MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname"
        );
        process.exit(1);
    }

    const validScheme = uri.trim().startsWith("mongodb://") || uri.trim().startsWith("mongodb+srv://");
    if (!validScheme) {
        console.error(
            "MONGODB connection FAILED: MONGODB_URI must start with mongodb:// or mongodb+srv://"
        );
        console.error(
            "Example: MONGODB_URI=mongodb://localhost:27017/tasquash"
        );
        process.exit(1);
    }

    try {
        const connectionInstance = await mongoose.connect(uri);
        console.log(
            `MongoDB is Hosted !! on : ${connectionInstance.connection.host}`
        );
    } catch (error) {
        console.log("MONGODB connection FAILED : ", error);
        process.exit(1);
    }
};

export default connectDB;