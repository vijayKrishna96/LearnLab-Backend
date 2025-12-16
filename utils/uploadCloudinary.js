const { cloudinaryInstance } = require("../config/cloudinaryConfig");
const fs = require("fs");

const uploadCloudinary = async (localFilePath, publicId) => {
  try {
    if (!localFilePath) {
      throw new Error("Local file path is required");
    }

    // Check if file exists
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File not found: ${localFilePath}`);
    }

    const response = await cloudinaryInstance.uploader.upload(localFilePath, {
      resource_type: 'auto',
      public_id: publicId,
      folder: 'courses'
    });

    // CRITICAL: Delete local file after successful upload
    fs.unlinkSync(localFilePath);

    return response;
  } catch (error) {
    console.error(`Cloudinary upload error: ${error.message}`);
    
    // Clean up local file even if upload fails
    if (localFilePath && fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (unlinkError) {
        console.error(`Error deleting local file: ${unlinkError.message}`);
      }
    }
    
    throw error;
  }
};

const deleteFromCloudinary = async (publicId) => {
  try {
    if (!publicId) {
      throw new Error("Public ID is required for deletion");
    }

    const response = await cloudinaryInstance.uploader.destroy(publicId, {
      resource_type: 'image'
    });

    if (response.result === 'ok' || response.result === 'not found') {
      console.log(`File with Public ID: ${publicId} deleted successfully.`);
      return response;
    } else {
      console.warn(`Unexpected response when deleting ${publicId}: ${response.result}`);
      return response;
    }
  } catch (error) {
    console.error(`Error deleting file from Cloudinary: ${error.message}`);
    throw error;
  }
};

// Helper to delete local files
const cleanupLocalFiles = (files) => {
  if (!files || !Array.isArray(files)) return;
  
  files.forEach(file => {
    if (file.path && fs.existsSync(file.path)) {
      try {
        fs.unlinkSync(file.path);
      } catch (error) {
        console.error(`Error deleting local file ${file.path}:`, error);
      }
    }
  });
};

module.exports = { uploadCloudinary, deleteFromCloudinary, cleanupLocalFiles };