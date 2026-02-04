class CourseUtils {
  static parseModules(modules) {
    return typeof modules === "string" ? JSON.parse(modules) : modules;
  }

  static calculateTotalDuration(modules) {
    return modules.reduce((total, module) => {
      return (
        total +
        module.lessons.reduce(
          (sum, lesson) => sum + Number(lesson.duration || 0),
          0
        )
      );
    }, 0);
  }

  /**
   * Assign lesson images safely
   * - uploadedImages: only lesson images
   * - existingModules: used during update
   */
  static processModulesWithImages(modules, uploadedImages = [], existingModules = []) {
    let imageIndex = 0;

    return modules.map((module, mIdx) => {
      const existingModule = existingModules[mIdx];

      return {
        moduleNumber: module.moduleNumber,
        title: module.title,
        lessons: module.lessons.map((lesson, lIdx) => {
          const existingLesson = existingModule?.lessons?.[lIdx];

          const image =
            uploadedImages[imageIndex]
              ? uploadedImages[imageIndex++]
              : existingLesson?.image || null;

          return {
            title: lesson.title,
            duration: lesson.duration,
            image
          };
        })
      };
    });
  }
}

export default CourseUtils;
