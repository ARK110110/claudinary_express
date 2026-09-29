import jwt from "jsonwebtoken";

function auth(req, res, next) {
  if (!req.headers?.authorization) {
    res.status(403).json({
      message: "PENYUSUP PENYUSUP",
    });
  }
  const token = req.headers.authorization?.split(" ")[1];
  // print(token)

  try {
    const decoded = jwt.verify(token, "KYKY");

    req.body = decoded;
    next();
  } catch (error) {
    res.status(403).json({
      message: "Invalid Token",
      token: token,
    });
  }
}

export default auth;
