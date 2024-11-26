import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId)
    const accessToken = user.generateAccessToken()
    const refreshToken = user.generateRefreshToken()

    //refresh token should be in db also
    user.refreshToken = refreshToken
    await user.save({ validateBeforeSave: false })

    return { accessToken, refreshToken }

  }
  catch (error) {
    throw new ApiError(500, "Something went wrong while generating refresh and access token")
  }
}

const registerUser = asyncHandler(async (req, res) => {
  //1. get user details from frontend (temporarily we are taking from postman)
  //2. validation of user details like all the required fields are there and email format
  //3. check if user already exists (this can be done by using email-unique)
  //4. check for images , check for avatar
  // if they are there then upload them to cloudinary
  //create user object - create an entry in DB
  //7. remove password and refresh token fields from response
  //check for user creation
  //return response if user created succesfully , else return error



  // 1.
  const { fullname, email, username, password } = req.body
  console.log("req.body:", req.body)
  console.log("email :", email)

  //2.
  if (
    [fullname, email, username, password].some((field) =>
      field.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");

  }

  //3.
  const existingUser = await User.findOne({ email })
  console.log("existingUser:", existingUser)
  if (existingUser) {
    throw new ApiError(409, "User with email already exists");
  }

  const avatarLocalPath = req.files?.avatar[0]?.path
  //  const coverImageLocalPath = req.files?.coverImage[0]?.path

  let coverImageLocalPath;
  if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
    coverImageLocalPath = req.files.coverImage[0].path
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required")
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath)
  const coverImage = await uploadOnCloudinary(coverImageLocalPath)

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");

  }

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase()
  })

  //7.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered Successfully")
  )

})

const loginUser = asyncHandler(async (req, res) => {
  //1. take data from req.body
  //2. check username and email are there or not
  //3. find the user
  //4. check the password if user exists
  //5. if password is correct send access and refresh token
  //6. send cookie and send response that login successfull

  //1.
  const { email, username, password } = req.body

  //2.
  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required")
  }

  //3.
  const user = await User.findOne({
    //checking the user existence with username or email if one is there also fine.
    //$or is mongodb operator - logical operator 
    $or: [{ username }, { email }]
  })

  if (!user) {
    throw new ApiError(404, "User does not exist")
  }

  //4.
  const isPasswordValid = await user.isPasswordCorrect(password)

  if (!isPasswordValid) {
    throw new ApiError(401, "Password Incorrect")
  }

  //5.
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

  //6.
  const options = {
    //by default cookies can be modified by anyone by doing these 2 ,
    // cookies can be modified only on server-side, we cannot modify cookies from frontend
    httpOnly: true,
    secure: true
  }
  return res.status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser, accessToken, refreshToken
        },
        "User logged in successfully"
      )
    )

})


const logoutUser = asyncHandler(async(req, res)=>{
  await  User.findByIdAndUpdate(
      //find that user and set that user refreshtoken as undefined
      req.user._id,
      {
        $set : {
          refreshToken : undefined
        }
      },
      {
        new : true
      }
    )

    const options = {
      httpOnly : true,
      secure : true
    }
    return res
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken" , options)
    .json(new ApiResponse(200, {} , "User logged out"))
})

const refreshAccessToken = asyncHandler(async(req , res) =>{
 try {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
 
    if(!incomingRefreshToken){
     throw new ApiError(401, "Unauthorized request")
    }
 
    //verify the token if token exists
    const decodedToken = jwt.verify(
     incomingRefreshToken,
     process.env.REFRESH_TOKEN_SECRET
    )
 
    const user = await User.findById(decodedToken._id)
    if(!user){
     throw new ApiError(401 , "Invalid Refresh Token")
    }
 
    if(incomingRefreshToken !== user?.refreshToken){
     throw new ApiError(401 , "Refresh token is expired or used")
    }
 
    const options = {
     httpOnly : true,
     secure : true
    }
 
    const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
 
    return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" , newRefreshToken , options)
    .json(
     new ApiResponse(
       200,
       {accessToken , refreshToken : newRefreshToken},
       "Access token refreshed"
     )
    )
 } catch (error) {
  throw new ApiError(401, error?.message || "Invalid refresh token")
  
 }


})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken
}