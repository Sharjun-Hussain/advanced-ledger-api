const successResponse = (res, data, message = 'Success') => {
    return res.status(200).json({ status: 'success', message, data });
};
const errorResponse = (res, message = 'Error', code = 400) => {
    return res.status(code).json({ status: 'error', message });
};

const paginatedResponse = (res, data, pagination, message = 'Success') => {
    return res.status(200).json({
        status: 'success',
        message,
        data,
        pagination,
    });
};

module.exports = { successResponse, errorResponse, paginatedResponse };
