import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Prompt } from "../models/prompt.models.js";
import { ApiError } from "../utils/ApiError.js";

const createPrompt = asyncHandler(async (req, res) => {
    //destructure required fields from request
    const { title, rawPrompt, enhancedPrompt, category, isPublic } = req.body;

    if (!title || !rawPrompt || !enhancedPrompt || !category) {
        throw new ApiError(400, "All fields (title, rawPrompt, enhancedPrompt, category) are required");
    }

    //save prompt data in db
    const prompt = await Prompt.create({
        title,
        rawPrompt,
        enhancedPrompt,
        category,
        isPublic: isPublic || false,
        userId: req.user?._id
    });

    if (!prompt) {
        throw new ApiError(500, "Failed to save prompt due to server error");
    }

    //return response
    res.status(201).json(new ApiResponse(201, prompt, "Prompt saved successfully"));
});

const getAllPrompts = asyncHandler(async (req, res) => {
    //get all prompts of the user
    const prompts = await Prompt.find({ userId: req.user?._id });

    //validate if prompts fetched successfully or not
    if(!prompts){
        throw new ApiError(400, "Failed to fetch prompts");
    }

    //return response
    res.status(200).json(new ApiResponse(200, prompts, "Prompts fetched successfully"));
});

const getPromptById = asyncHandler(async (req, res) => {

    //get prompt by id
    const { id } = req.params;
    const prompt = await Prompt.findById(id);

    //validate if prompt found or not
    if (!prompt) {
        throw new ApiError(404, "Prompt not found");
    }

    //validate if user is authorized to access this prompt
    if (prompt.userId.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to access this prompt");
    }

    //return response
    res.status(200).json(new ApiResponse(200, prompt, "Prompt fetched successfully"));
});

const deletePrompt = asyncHandler(async (req, res) => {

    //get prompt by id
    const { id } = req.params;
    const prompt = await Prompt.findById(id);

    //validate if prompt found or not
    if (!prompt) {
        throw new ApiError(404, "Prompt not found");
    }

    //validate if user is authorized to delete this prompt
    if (prompt.userId.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this prompt");
    }

    //delete prompt
    await Prompt.findByIdAndDelete(id);

    //return response
    res.status(200).json(new ApiResponse(200, {}, "Prompt deleted successfully"));
});

const makePromptPublic = asyncHandler(async (req, res) => {

    //get prompt by id
    const { id } = req.params;
    const prompt = await Prompt.findById(id);

    //validate if prompt found or not
    if (!prompt) {
        throw new ApiError(404, "Prompt not found");
    }

    //validate if user is authorized to make this prompt public
    if (prompt.userId.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to make this prompt public");
    }

    //make prompt public
    prompt.isPublic = true;
    await prompt.save();

    //return response
    res.status(200).json(new ApiResponse(200, prompt, "Prompt made public successfully"));
});

const publicPrompts = asyncHandler(async (req, res) => {

    //get all public prompts
    const prompts = await Prompt.find({ isPublic: true });

    //validate if prompts fetched successfully or not
    if(!prompts){
        throw new ApiError(400, "Failed to fetch public prompts");
    }

    //return response
    res.status(200).json(new ApiResponse(200, prompts, "Public prompts fetched successfully"));
});

export { 
    createPrompt, 
    getAllPrompts, 
    getPromptById, 
    deletePrompt, 
    makePromptPublic,
    publicPrompts
};