class CourseUtils {
  // Process modules with images
  static processModules(modules, uploadedImages, existingCourse = null) {
    let imageIndex = 1; // First image is for course main image

    return modules.map(module => {
      const processedLessons = module.lessons.map(lesson => {
        let lessonImage = null;

        // Assign new uploaded image
        if (imageIndex < uploadedImages.length) {
          lessonImage = uploadedImages[imageIndex++];
        } 
        // Keep existing image if updating
        else if (existingCourse) {
          const existingLesson = existingCourse.modules
            .find(m => m.moduleNumber === module.moduleNumber)
            ?.lessons.find(l => l.title === lesson.title);
          lessonImage = existingLesson?.image || null;
        }

        return {
          title: lesson.title,
          duration: lesson.duration,
          image: lessonImage
        };
      });

      return {
        moduleNumber: module.moduleNumber,
        title: module.title,
        lessons: processedLessons
      };
    });
  }

  // Calculate total course duration
  static calculateTotalDuration(modules) {
    return modules.reduce((total, module) => {
      return total + module.lessons.reduce((sum, lesson) => {
        return sum + parseInt(lesson.duration || 0);
      }, 0);
    }, 0);
  }

  // Parse modules (handle string or object)
  static parseModules(modules) {
    return typeof modules === 'string' ? JSON.parse(modules) : modules;
  }

  // Find missing IDs
  static findMissingIds(requestedIds, foundCourses) {
    const foundIds = foundCourses.map(course => course._id.toString());
    return requestedIds.filter(id => !foundIds.includes(id.toString()));
  }
}

module.exports = CourseUtils;