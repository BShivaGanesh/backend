//using promises
//asyncHandler is a higher order function
const asyncHandler = (requestHandler) => {
   return (req,res,next)=>{
        Promise
        .resolve(requestHandler(req,res,next))
        .catch((err)=> next(err))
    }
 
}

export  {asyncHandler}

// we can do the same using try-catch also
// const asyncHandler = (requestHandler) => async(req,res,next)=>{
//     try{
//         await requestHandler(req,res,next)
//     }
//     catch(error){
//         res.status(error.code || 400).json({
//             success : false,
//             message : error.message
//         })
//     }
// }
