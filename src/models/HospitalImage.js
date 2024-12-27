const BaseModel = require("./BaseModel");

class HospitalImage extends BaseModel {
  static tableName = "hospital_images";

  static async create(data) {
    try {
      console.log("Creating hospital image with data:", data);

      // Đảm bảo các trường bắt buộc
      if (!data.hospital_id) {
        throw new Error("hospital_id is required");
      }
      if (!data.image_url) {
        throw new Error("image_url is required");
      }

      const sql = `
        INSERT INTO ${this.tableName} 
        (hospital_id, image_url, created_by)
        VALUES (?, ?, ?)
      `;

      const params = [
        data.hospital_id,
        data.image_url,
        data.created_by || null, // Nếu không có created_by thì dùng null
      ];

      console.log("SQL:", sql);
      console.log("Params:", params);

      const result = await this.query(sql, params);
      console.log("Insert result:", result);

      return this.findById(result.insertId);
    } catch (error) {
      console.error("Error in HospitalImage.create:", error);
      throw error;
    }
  }

  static async findByHospitalId(hospitalId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE hospital_id = ?
      ORDER BY created_at DESC
    `;
    return await this.query(sql, [hospitalId]);
  }

  static async findById(id) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE id = ?
    `;
    const [result] = await this.query(sql, [id]);
    return result;
  }

  static async delete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    await this.query(sql, [id]);
    return true;
  }
}

module.exports = HospitalImage;