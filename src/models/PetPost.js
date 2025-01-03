const BaseModel = require("./BaseModel");
const convertBitToBoolean = require("../utils/convertBitToBoolean");

class PetPost extends BaseModel {
  static tableName = "pet_posts";

  constructor(data) {
    super();
    if (data) {
      Object.assign(this, {
        ...data,
        is_deleted: convertBitToBoolean(data.is_deleted),
        is_featured: convertBitToBoolean(data.is_featured),
      });
    }
  }

  // Lấy danh sách bài viết có phân trang và filter
  static async findAll(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        postType,
        category,
        status = "PUBLISHED",
        authorId,
        hospitalId,
        tags,
        isFeatured,
        sortBy = "created_at",
        sortOrder = "DESC",
        includeDeleted = false,
      } = options;

      console.log("Query options:", options);

      const offset = (page - 1) * limit;
      let conditions = [];
      let params = [];

      if (!includeDeleted) {
        conditions.push("p.is_deleted = ?");
        params.push(0);
      }

      if (postType) {
        conditions.push("p.post_type = ?");
        params.push(postType);
      }

      if (category) {
        conditions.push("p.category = ?");
        params.push(category);
      }

      if (status) {
        conditions.push("p.status = ?");
        params.push(status);
      }

      if (authorId) {
        conditions.push("p.author_id = ?");
        params.push(Number(authorId));
      }

      if (hospitalId) {
        conditions.push("p.hospital_id = ?");
        params.push(Number(hospitalId));
      }

      if (tags) {
        conditions.push("p.tags LIKE ?");
        params.push(`%${tags}%`);
      }

      if (isFeatured !== undefined) {
        conditions.push("p.is_featured = ?");
        params.push(isFeatured ? 1 : 0);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      const validSortColumns = [
        "created_at",
        "published_at",
        "views_count",
        "likes_count",
        "comments_count",
      ];
      const validSortOrders = ["ASC", "DESC"];

      const finalSortBy = validSortColumns.includes(sortBy)
        ? sortBy
        : "created_at";
      const finalSortOrder = validSortOrders.includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      const sql = `
        SELECT p.*, 
               u.full_name as author_name,
               u.avatar as author_avatar,
               h.name as hospital_name
        FROM ${this.tableName} p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN hospitals h ON p.hospital_id = h.id
        ${whereClause}
        ORDER BY p.${finalSortBy} ${finalSortOrder}
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `;

      console.log("SQL Query:", sql);
      console.log("Query params:", params);

      const [posts, [countResult]] = await Promise.all([
        this.query(sql, params),
        this.query(
          `
          SELECT COUNT(*) as total
          FROM ${this.tableName} p
          ${whereClause}
        `,
          params
        ),
      ]);

      console.log("Query results:", { posts, countResult });

      return {
        posts: posts.map((post) => new PetPost(post)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / Number(limit)),
        },
      };
    } catch (error) {
      console.error("Find all posts error:", error);
      throw error;
    }
  }

  // Lấy chi tiết bài viết
  static async getDetail(id, includeDeleted = false) {
    try {
      const sql = `
        SELECT p.*, 
               u.full_name as author_name,
               u.avatar as author_avatar,
               h.name as hospital_name
        FROM ${this.tableName} p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN hospitals h ON p.hospital_id = h.id
        WHERE p.id = ? ${!includeDeleted ? "AND p.is_deleted = 0" : ""}
      `;

      const [post] = await this.query(sql, [id]);
      if (!post) return null;
      return new PetPost(post);
    } catch (error) {
      console.error("Get post detail error:", error);
      throw error;
    }
  }

  // Cập nhật số lượng tương tác
  static async updateCounts(id) {
    try {
      const [[likesResult], [commentsResult]] = await Promise.all([
        this.query(
          "SELECT COUNT(*) as count FROM pet_post_likes WHERE post_id = ?",
          [id]
        ),
        this.query(
          "SELECT COUNT(*) as count FROM pet_post_comments WHERE post_id = ? AND is_deleted = 0",
          [id]
        ),
      ]);

      await this.update(id, {
        likes_count: likesResult.count,
        comments_count: commentsResult.count,
      });
    } catch (error) {
      console.error("Update counts error:", error);
      throw error;
    }
  }

  // Tăng lượt xem
  static async incrementViewCount(id) {
    try {
      await this.query(
        `UPDATE ${this.tableName} SET views_count = views_count + 1 WHERE id = ?`,
        [id]
      );
    } catch (error) {
      console.error("Increment view count error:", error);
      throw error;
    }
  }

  // Xóa bài viết và tất cả dữ liệu liên quan
  static async delete(id) {
    try {
      // Xóa tất cả comments
      const PetPostComment = require("./PetPostComment");
      await PetPostComment.deleteAllByPostId(id);

      // Xóa tất cả likes
      await this.query(`DELETE FROM pet_post_likes WHERE post_id = ?`, [id]);

      // Xóa bài viết
      const sql = `
        DELETE FROM ${this.tableName}
        WHERE id = ?
      `;

      const result = await this.query(sql, [id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error("Delete post error:", error);
      throw error;
    }
  }

  // Xóa nhiều bài viết
  static async deleteMany(ids) {
    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("Danh sách ID không hợp lệ");
      }

      // Xóa tất cả dữ liệu liên quan
      await Promise.all([
        this.query(`DELETE FROM pet_post_comments WHERE post_id IN (?)`, [ids]),
        this.query(`DELETE FROM pet_post_likes WHERE post_id IN (?)`, [ids]),
      ]);

      // Xóa các bài viết
      const sql = `
        DELETE FROM ${this.tableName}
        WHERE id IN (?)
      `;

      const result = await this.query(sql, [ids]);
      return result.affectedRows;
    } catch (error) {
      console.error("Delete many posts error:", error);
      throw error;
    }
  }

  // Kiểm tra quyền sở hữu bài viết
  static async isOwnedByUser(postId, userId) {
    try {
      const [post] = await this.query(
        `SELECT author_id FROM ${this.tableName} WHERE id = ?`,
        [postId]
      );

      return post && post.author_id === userId;
    } catch (error) {
      console.error("Check post ownership error:", error);
      throw error;
    }
  }

  // Cập nhật trạng thái bài viết
  static async updateStatus(id, status, publishedAt = null) {
    try {
      const validStatuses = ["DRAFT", "PENDING", "PUBLISHED", "ARCHIVED"];
      if (!validStatuses.includes(status)) {
        throw new Error("Trạng thái không hợp lệ");
      }

      const sql = `
        UPDATE ${this.tableName}
        SET status = ?, 
            published_at = ?
        WHERE id = ?
      `;

      await this.query(sql, [
        status,
        status === "PUBLISHED" ? publishedAt || new Date() : publishedAt,
        id,
      ]);

      return this.getDetail(id);
    } catch (error) {
      console.error("Update post status error:", error);
      throw error;
    }
  }

  // Cập nhật trạng thái featured
  static async toggleFeatured(id) {
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET is_featured = NOT is_featured
        WHERE id = ?
      `;

      await this.query(sql, [id]);
      return this.getDetail(id);
    } catch (error) {
      console.error("Toggle featured error:", error);
      throw error;
    }
  }

  // Tìm kiếm bài viết theo tiêu đề
  static async search(searchQuery, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status = "PUBLISHED"
      } = options;

      const offset = (page - 1) * limit;
      let conditions = ["p.is_deleted = 0"];
      let params = [];

      // Tìm kiếm theo tiêu đề
      if (searchQuery) {
        conditions.push("p.title LIKE ?");
        params.push(`%${searchQuery}%`);
      }

      // Lọc theo trạng thái
      if (status) {
        conditions.push("p.status = ?");
        params.push(status);
      }

      const sql = `
        SELECT 
          p.*,
          u.full_name as author_name,
          u.avatar as author_avatar,
          h.name as hospital_name
        FROM ${this.tableName} p
        LEFT JOIN users u ON p.author_id = u.id
        LEFT JOIN hospitals h ON p.hospital_id = h.id
        WHERE ${conditions.join(" AND ")}
        ORDER BY p.created_at DESC
        LIMIT ? OFFSET ?
      `;

      const countSql = `
        SELECT COUNT(*) as total
        FROM ${this.tableName} p
        WHERE ${conditions.join(" AND ")}
      `;

      const [posts, [countResult]] = await Promise.all([
        this.query(sql, [...params, limit, offset]),
        this.query(countSql, params)
      ]);

      return {
        posts: posts.map(post => new this(post)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      console.error("Search posts error:", error);
      throw error;
    }
  }

  // Thêm phương thức soft delete
  static async softDelete(id) {
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET is_deleted = 1, 
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.query(sql, [id]);
      return true;
    } catch (error) {
      console.error("Soft delete post error:", error);
      throw error;
    }
  }

  // Thêm phương thức soft delete nhiều bài viết
  static async softDeleteMany(ids) {
    try {
      const sql = `
        UPDATE ${this.tableName}
        SET is_deleted = 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (?)
      `;

      await this.query(sql, [ids]);
      return true;
    } catch (error) {
      console.error("Soft delete many posts error:", error);
      throw error;
    }
  }
}

module.exports = PetPost;
