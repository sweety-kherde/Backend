import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken";


const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }
  }
  catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh and access token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  // res.status(200).json({
  //   message: "Ok"
  // })
  const { fullname, email, username, password } = req.body
  if (
    [fullname, email, username, password].some((field) => field?.trim() === "")) {
    throw new ApiError(400, "All fields are required")
  }
  const existedUser = await User.findOne({
    $or: [{ username }, { email }]
  })
  if (existedUser) {
    throw new ApiError(409, "Username already exist ")
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  //const coverImageLocalPath = req.files?.coverImage[0]?.path;
  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  if (!avatar) {
    throw new ApiError(400, "Avatar file is required")
  }
  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })
  const createduser = await User.findById(user._id).select("-password -refreshToken")
  if (!createduser) {
    throw new ApiError(500, "Something went wrong while registering user")
  }
  return res.status(201).json(
    new ApiResponse(200, createduser, "User Registered Successfully")
  )

})

const loginUser = asyncHandler(async (req, res) => {
  //req body data
  //username or email access
  //find the user
  //password check
  //access and refresh token
  //send cookies
  const { email, username, password } = req.body

  if (!(username || email)) {
    throw new ApiError(400, "username or email is required")
  }
  const user = await User.findOne({
    $or: [{ username }, { email }]
  })
  if (!user) {
    throw new ApiError(404, "user does'nt exist")
  }

  const isPasswordValid = await user.isPasswordCorrect(password)
  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user credentials")
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  const options = {
    httpOnly: true,
    secure: true
  }
  return res.status(200).cookie("accessToken", accessToken, options).cookie("refreshToken", refreshToken, options).json(
    new ApiResponse(
      200, {
      user: loggedInUser, accessToken,
      refreshToken
    },
      "User logged In Successfully"
    )
  )
})
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: undefined
      }
    },
    {
      new: true
    }

  )
  const options = {
    httpOnly: true,
    secure: true
  }

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"))
})
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken = req.cookie.refreshToken || req.body.refreshToken
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request")
  }
  try {
    const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    const user = await User.findById(decodedToken?._id)
    if (!user) {
      throw new ApiError(401, "invalid refresh token")
    }
    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used")
    }
    const options = {
      httpOnly: true,
      secure: true
    }
    const { accessToken, newrefreshToken } = await generateAccessAndRefreshTokens(user._id)
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newrefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newrefreshToken },
          "Access token refreshed"
        )
      )
  }
  catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token")
  }
})
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body
  const user = await User.findById(req.user?._id)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
  if (!isPasswordCorrect) {
    throw new ApiError(400, "Invalid old password")
  }
  user.password = newPassword
  await user.save({ validateBeforeSave: false })
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password chnaged successfully"))
})
const getCurrentUser = asyncHandler(async (req, re) => {
  return res
    .status(200)
    .json(200, req.user, "Current user fetched successfully")
})
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body
  if (!fullname || !email) {
    throw
    new ApiError(400, "All fields are required")
  }
  const user = User.findByIdAndUpdate(req.user?._id,
    {
      $set: {
        fullname,
        email
      }
    }, { new: true }
  ).select("-password")
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing")
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath)
  if (!avatar.url) {
    throw new ApiError(400, "Error while uploading on avatar")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url
      }
    }, { new: true }
  ).select("-password")
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated Successfully"))
})
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing")
  }
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)
  if (!coverImage.url) {
    throw new ApiError(400, "Error while uploading on Cover Image")
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    }, { new: true }
  ).select("-password")
  return res
    .status(200)
    .json(new ApiResponse(200, user, "CoverImage updated Successfully"))
})
export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage }

// export const registerUser = async (req, res) => {
//   console.log("✅ registerUser function executed", req.body);
//   res.status(200).json({ message: "User registration successful!" });
// };
