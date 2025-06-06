import mongoose from "mongoose";

const ConnectDB = async () => {
    try {
        const res = await mongoose.connect(process.env.DB_URI)
        console.log(`Database contected successfull ! ->>> ${res.connection.host}`);

    } catch (error) {
        console.log(`Database connection failed ! ->>> ${error}`);

    }
}
export default ConnectDB;