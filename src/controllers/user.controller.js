import { asyncHandler } from "../utils/asyncHandler.js"
const registerUser = asyncHandler(async (req, res) => {
  res.status(200).json({
    message: "Ok"
  })
})
export { registerUser, }
// export const registerUser = async (req, res) => {
//   console.log("✅ registerUser function executed", req.body);
//   res.status(200).json({ message: "User registration successful!" });
// };
