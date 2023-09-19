import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { categories, Category, Post, PostModel } from '../models/Post';
import expressAsyncHandler from 'express-async-handler';
import { Types } from 'mongoose';

type ErrorMessage = {
    message: string;
    status: number;
};

export const INVALID_ID: ErrorMessage = {
    message: 'Failed to fetch - invalid ID format',
    status: 400,
};
export const INVALID_QUERY: ErrorMessage = {
    message: 'Failed to fetch - invalid query',
    status: 400,
};
export const DOES_NOT_EXIST: ErrorMessage = {
    message: 'Failed to fetch - no resource with that ID',
    status: 404,
};

/*
    - GET
*/
export const getAllPosts = expressAsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        // Show newest posts first
        const posts = await Post.find().sort({ timestamp: -1 }).exec();

        res.json(posts);
    }
);

// GET INDIVIDUAL POST
export const getSpecificPost = expressAsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        if (!Types.ObjectId.isValid(req.params.postID)) {
            res.status(400).json(INVALID_ID);
            return;
        }

        const post = await Post.findById(req.params.postID).exec();

        if (!post) {
            res.status(404).json(DOES_NOT_EXIST);
        } else {
            res.json(post);
        }
    }
);

/*
    - POST
*/
export const postNewPost: FormPOSTHandler = [
    body('title', 'Title must not be empty').trim().notEmpty().escape(),

    body('category', 'Category must be one of the listed options').toLowerCase().isIn(categories),

    body('text', 'Article cannot be empty')
        .trim()
        .notEmpty()
        .escape()
        .customSanitizer(convertToArrayOfParagraphs),

    // Selection will be converted into a boolean, with the default value being false unless the
    // 'yes' option was selected specifically
    body('isPublished')
        .trim()
        .toLowerCase()
        .escape()
        .customSanitizer((selection: string): boolean => selection === 'yes'),

    expressAsyncHandler(async (req: Request, res: Response): Promise<void> => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.json({
                errors: errors.array(),
            });
        } else {
            // Only create and store a new post if no errors
            const post = new Post<PostModel>({
                // TODO: to be replaced once JWT auth implemented
                author: new Types.ObjectId('65068c32be2fd5ade9800662'),
                title: req.body.title as string,
                timestamp: new Date(),
                category: req.body.category as Category,
                text: req.body.text as string[],
                isPublished: req.body.isPublished as boolean,
            });

            await post.save();
            res.json(post);
        }
    }),
];

/*
    - PUT
*/
export const editPost: FormPOSTHandler = [
    body('title', 'Title must not be empty').optional().trim().notEmpty().escape(),

    body('category', 'Category must be one of the listed options')
        .toLowerCase()
        .optional()
        .isIn(categories),

    body('text', 'Article cannot be empty')
        .optional()
        .trim()
        .notEmpty()
        .escape()
        .customSanitizer((text: string): string[] =>
            // Convert text into array of paragraphs
            text.replaceAll('\r', '').replaceAll(/\n+/g, '\n').split('\n')
        ),

    // Selection will be converted into a boolean, with the default value being false unless the
    // 'yes' option was selected specifically
    body('isPublished')
        .optional()
        .trim()
        .toLowerCase()
        .escape()
        .customSanitizer((selection: string): boolean => selection === 'yes'),

    expressAsyncHandler(async (req: Request, res: Response): Promise<void> => {
        if (!Types.ObjectId.isValid(req.params.postID)) {
            res.status(400).json(INVALID_ID);
            return;
        }

        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.json({
                errors: errors.array(),
            });
        } else {
            const existingPost = await Post.findById(req.params.postID).exec();

            if (!existingPost) {
                res.status(404).json(DOES_NOT_EXIST);
            } else {
                // Only create and store a new post if no errors
                const postWithEdits = new Post<PostModel>({
                    _id: existingPost._id,
                    author: existingPost.author,
                    title: req.body.title ?? existingPost.title,
                    timestamp: existingPost.timestamp,
                    category: req.body.category ?? existingPost.category,
                    text: req.body.text ?? existingPost.text,
                    isPublished: req.body.isPublished ?? existingPost.isPublished,
                });

                const editedPost = await Post.findByIdAndUpdate(req.params.postID, postWithEdits, {
                    new: true,
                });

                res.json(editedPost);
            }
        }
    }),
];

/*
    - PATCH
*/
export const publishPost = expressAsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        if (
            !Types.ObjectId.isValid(req.params.postID) ||
            !['true', 'false'].includes(req.query.publish as string)
        ) {
            const message = !Types.ObjectId.isValid(req.params.postID) ? INVALID_ID : INVALID_QUERY;

            res.status(400).json(message);
            return;
        }

        const newPublishedStatus = req.query.publish === 'true';

        const editedPost = await Post.findByIdAndUpdate(
            req.params.postID,
            { isPublished: newPublishedStatus },
            { new: true }
        ).exec();

        if (!editedPost) {
            res.status(404).json(DOES_NOT_EXIST);
        } else {
            res.json(editedPost);
        }
    }
);

/*
    - DELETE
*/
export const deletePost = expressAsyncHandler(
    async (req: Request, res: Response): Promise<void> => {
        if (!Types.ObjectId.isValid(req.params.postID)) {
            res.status(400).json(INVALID_ID);
            return;
        }

        const deletedPost = await Post.findByIdAndDelete(req.params.postID).exec();

        if (!deletedPost) {
            res.status(404).json(DOES_NOT_EXIST);
        } else {
            res.json(deletedPost);
        }
    }
);

export function convertToArrayOfParagraphs(text: string): string[] {
    // Convert text into array of paragraphs
    return text.replaceAll('\r', '').replaceAll(/\n+/g, '\n').split('\n');
}
