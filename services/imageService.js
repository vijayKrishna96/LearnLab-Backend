const { uploadCloudinary, deleteFromCloudinary } = require('../utils/uploadCloudinary');

class ImageService {
  // Upload multiple images
  async uploadCourseImages(files) {
    if (!files || files.length === 0) {
      return [];
    }

    const uploadPromises = files.map(async (file, index) => {
      const publicId = `courses/${Date.now()}-${index}`;
      const result = await uploadCloudinary(file.path, publicId);
      return {
        publicId: result.public_id,
        url: result.secure_url
      };
    });

    return await Promise.all(uploadPromises);
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
    for (const module of course.modules) {
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

    await Promise.all(deletePromises);
  }
}

module.exports = new ImageService();
