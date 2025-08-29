export const protectRoute = (req, res, next) => {
  const auth = req.auth?.(); // Clerk requires calling it

  if (!auth || !auth.userId) {
    return res
      .status(401)
      .json({ message: "Unauthorized - You must be logged in" });
  }

  next();
};
