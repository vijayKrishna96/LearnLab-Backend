const { uploadCloudinary, deleteFromCloudinary, cleanupLocalFiles } = require('../utils/uploadCloudinary');

class ImageService {
  // Upload multiple images with proper error handling
  async uploadCourseImages(files) {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadedImages = [];
    const failedUploads = [];

    try {
      // Upload sequentially to maintain order
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
          const publicId = `courses/${Date.now()}-${i}`;
          const result = await uploadCloudinary(file.path, publicId);
          
          uploadedImages.push({
            publicId: result.public_id,
            url: result.secure_url
          });
        } catch (error) {
          console.error(`Failed to upload file ${file.originalname}:`, error);
          failedUploads.push(file);
        }
      }

      // If some uploads failed, rollback successful uploads
      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} files failed to upload. Rolling back...`);
        await this.rollbackUploads(uploadedImages);
        throw new Error(`Failed to upload ${failedUploads.length} file(s)`);
      }

      return uploadedImages;
    } catch (error) {
      // Clean up any remaining local files
      cleanupLocalFiles(files);
      throw error;
    }
  }

  // Upload single image
  async uploadSingleImage(file, folder = 'courses') {
    if (!file) {
      return null;
    }

    try {
      const publicId = `${folder}/${Date.now()}`;
      const result = await uploadCloudinary(file.path, publicId);
      
      return {
        publicId: result.public_id,
        url: result.secure_url
      };
    } catch (error) {
      console.error(`Failed to upload file:`, error);
      cleanupLocalFiles([file]);
      throw error;
    }
  }

  // Delete course images (main + lessons)
  async deleteCourseImages(course) {
    const deletePromises = [];

    // Delete main course image
    if (course.image?.publicId) {
      deletePromises.push(
        deleteFromCloudinary(course.image.publicId).catch(err => 
          console.error(`Error deleting image ${course.image.publicId}:`, err)
        )
      );
    }

    // Delete all lesson images
    if (course.modules && Array.isArray(course.modules)) {
      for (const module of course.modules) {
        if (module.lessons && Array.isArray(module.lessons)) {
          for (const lesson of module.lessons) {
            if (lesson.image?.publicId) {
              deletePromises.push(
                deleteFromCloudinary(lesson.image.publicId).catch(err =>
                  console.error(`Error deleting lesson image ${lesson.image.publicId}:`, err)
                )
              );
            }
          }
        }
      }
    }

    await Promise.allSettled(deletePromises);
  }

  // Rollback uploaded images in case of failure
  async rollbackUploads(uploadedImages) {
    const deletePromises = uploadedImages.map(img => 
      deleteFromCloudinary(img.publicId).catch(err =>
        console.error(`Rollback failed for ${img.publicId}:`, err)
      )
    );

    await Promise.allSettled(deletePromises);
  }

  // Delete specific images by public IDs
  async deleteImagesByPublicIds(publicIds) {
    if (!publicIds || publicIds.length === 0) {
      return;
    }

    const deletePromises = publicIds.map(publicId =>
      deleteFromCloudinary(publicId).catch(err =>
        console.error(`Error deleting image ${publicId}:`, err)
      )
    );

    await Promise.allSettled(deletePromises);
  }
}

module.exports = new ImageService();
