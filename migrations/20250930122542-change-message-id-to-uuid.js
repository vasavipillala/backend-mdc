"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    // Drop default first
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" DROP DEFAULT;
    `);

    // Change type from INTEGER → UUID
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" TYPE UUID USING gen_random_uuid();
    `);

    // Set new default for future inserts
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
    `);
  },

  async down(queryInterface, Sequelize) {
    // Rollback to INTEGER with auto increment
    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" DROP DEFAULT;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" TYPE INTEGER USING 1;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "Messages" ALTER COLUMN "id" SET DEFAULT nextval('"Messages_id_seq"'::regclass);
    `);
  },
};
