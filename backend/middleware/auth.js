module.exports = function (req, res, next) {
  const token = req.headers.authorization || req.query.token;
  if (!token || token !== "secure_token_123") {
    return res.status(403).json({ message: "Unauthorized" });
  }
  next();
};