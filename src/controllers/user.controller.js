import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler( async (req , res)=>{
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
   const {fullname , email , username , password} = req.body
   console.log("req.body:" , req.body)
   console.log("email :" , email)

   //2.
   if(
    [fullname , email , username , password].some((field)=>
    field.trim() === "")
   ){
        throw new ApiError(400 , "All fields are required");
        
   }

   //3.
  const existingUser =  User.findOne({email})
  console.log("existingUser:" , existingUser)
  if(existingUser){
    throw new ApiError(409,"User with email already exists"); 
  }

 const avatarLocalPath =  req.files?.avatar[0]?.path
 const coverImageLocalPath = req.files?.coverImage[0]?.path

 if(!avatarLocalPath){
    throw new ApiError(400, "Avatar file is required")
 }

   const avatar = await uploadOnCloudinary(avatarLocalPath)
   const coverImage = await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar){
        throw new ApiError(400 , "Avatar file is required");
        
   }

  const user = await User.create({
    fullname,
    avatar : avatar.url,
    coverImage : coverImage?.url || "",
    email,
    password,
    username : username.toLowerCase()
   })

   //7.
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  )

  if(!createdUser){
    throw new ApiError(500, "Something went wrong while registering the user")
  }

  return res.status(201).json(
    new ApiResponse(200 , createdUser , "User registered Successfully")
  )

})

export {registerUser}