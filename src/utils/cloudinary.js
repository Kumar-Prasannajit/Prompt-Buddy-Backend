import {v2 as cloudinary} from "cloudinary";
import fs from "fs";

const uploadToCloudinary = async (localFilePath) => {
    //configure cloudinary inside the function to ensure env variables are loaded
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    try {
        //validation if local file path is provided
        if(!localFilePath){
            throw new Error("Local file path is required");
        }

        //upload image to cloudinary
        const response = await cloudinary.uploader.upload(
            localFilePath,
            {
                resource_type: "auto"
            }
        )

        //remove the locally saved img file after uploading to cloudinary to save space
        fs.unlinkSync(localFilePath);
        console.log("File uploaded successfully", response.url);

        //return only the secure URL of avatar img file
        return response.secure_url;

    } catch (error) {

        //remove the locally saved file as the upload failed
        if(fs.existsSync(localFilePath)){
            fs.unlinkSync(localFilePath);
        }
        console.error("Failed to upload img to cloudinary", error)
        throw error;
    }
}

export { uploadToCloudinary }