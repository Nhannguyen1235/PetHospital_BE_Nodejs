const ReviewService = require("../services/ReviewService");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../exceptions/ApiError");
const HospitalService = require("../services/HospitalService");

class ReviewController {
  // Tạo review mới
  createReview = asyncHandler(async (req, res) => {
    // kiểm tra bệnh viện có tồn tại không
    const hospital = await HospitalService.getHospitalById(
      req.body.hospital_id
    );
    if (!hospital) {
      throw new ApiError(404, "Bệnh viện không tồn tại");
    }

    const review = await ReviewService.createReview(
      req.body,
      req.user.id,
      req.file
    );
    res.status(201).json({
      status: "success",
      message: "Đã tạo đánh giá thành công",
      data: review,
    });
  });

  // Lấy danh sách review
  getReviews = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, ...filters } = req.query;
    const reviews = await ReviewService.getReviews(filters, page, limit);
    res.json({
      status: "success",
      data: reviews,
    });
  });

  // Lấy chi tiết review
  getReviewById = asyncHandler(async (req, res) => {
    const review = await ReviewService.getReviewById(req.params.id);
    res.json({
      status: "success",
      data: review,
    });
  });

  // Báo cáo review
  reportReview = asyncHandler(async (req, res) => {
    const review = await ReviewService.reportReview(
      req.params.id,
      req.body,
      req.user.id
    );
    res.json({
      status: "success",
      message: "Đã báo cáo đánh giá thành công",
      data: review,
    });
  });

  // Lấy thống kê đánh giá của bệnh viện
  getHospitalStats = asyncHandler(async (req, res) => {
    const stats = await ReviewService.getHospitalStats(req.params.hospitalId);
    res.json({
      status: "success",
      data: stats,
    });
  });

  // Toggle trạng thái xóa của review
  async toggleSoftDelete(req, res, next) {
    try {
      const { id } = req.params;
      const review = await ReviewService.toggleSoftDelete(
        id,
        req.user.id,
        req.user.role
      );

      res.json({
        status: "success",
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  // Cập nhật review
  updateReview = asyncHandler(async (req, res) => {
    const review = await ReviewService.updateReview(
      req.params.id,
      req.body,
      req.user.id,
      req.file
    );
    res.json({
      status: "success",
      message: "Đã cập nhật đánh giá thành công",
      data: review,
    });
  });

  // Kiểm tra có thể review không
  canUserReview = asyncHandler(async (req, res) => {
    const result = await ReviewService.canUserReview(
      req.user.id,
      req.params.hospitalId
    );
    res.json({
      status: "success",
      data: result,
    });
  });

  // Lấy danh sách review theo hospital
  async getHospitalReviews(req, res, next) {
    try {
      const { hospitalId } = req.params;
      const { page, limit } = req.query;

      const result = await ReviewService.getHospitalReviews(hospitalId, {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
      });

      res.json({
        status: "success",
        data: result.reviews,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  getUserReviews = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const reviews = await ReviewService.getUserReviews(
      req.user.id,
      parseInt(page),
      parseInt(limit)
    );

    res.json({
      status: "success",
      data: reviews,
    });
  });

  deleteReview = asyncHandler(async (req, res) => {
    const result = await ReviewService.deleteReview(
      req.params.id,
      req.user.id,
      req.user.role === "ADMIN"
    );

    res.json(result);
  });

  hardDeleteReview = asyncHandler(async (req, res) => {
    const result = await ReviewService.hardDelete(req.params.id);
    res.json(result);
  });
}

module.exports = new ReviewController();
