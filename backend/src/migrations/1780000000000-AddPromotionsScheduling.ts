import { MigrationInterface, QueryRunner } from "typeorm"

export class AddPromotionsScheduling1780000000000 implements MigrationInterface {
    name = 'AddPromotionsScheduling1780000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`custom_messages\` ADD \`display_duration_seconds\` int NULL`)
        await queryRunner.query(`ALTER TABLE \`custom_messages\` ADD \`active_days\` text NULL`)
        await queryRunner.query(`ALTER TABLE \`custom_messages\` MODIFY \`media_url\` longtext NULL`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`custom_messages\` MODIFY \`media_url\` varchar(255) NULL`)
        await queryRunner.query(`ALTER TABLE \`custom_messages\` DROP COLUMN \`active_days\``)
        await queryRunner.query(`ALTER TABLE \`custom_messages\` DROP COLUMN \`display_duration_seconds\``)
    }
}
