import express from "express";
const router = express.Router();
import { addLike,removeLike, sharePost,commentOnPost, reportPost} from '../../scripts/social/interactions.js';

// Route to like a post
router.post('/like/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.body.userId; // Assuming user ID is sent in the request body
        const result = await addLike(postId, userId);
        res.status(200).json({ message: 'Post liked successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Error liking post', error });
    }
});

// Route to unlike a post
router.delete('/like/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.body.userId; // Assuming user ID is sent in the request body
        const result = await removeLike(postId, userId);
        res.status(200).json({ message: 'Post unliked successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Error unliking post', error });
    }
});

// Route to share a post
router.post('/share/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.body.userId; // Assuming user ID is sent in the request body
        const result = await sharePost(postId, userId);
        res.status(200).json({ message: 'Post shared successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Error sharing post', error });
    }
});

// Route to comment on a post
router.post('/comment/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.body.userId; // Assuming user ID is sent in the request body
        const comment = req.body.comment;
        const result = await commentOnPost(postId, userId, comment);
        res.status(200).json({ message: 'Comment added successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment', error });
    }
});

// Route to report a post
router.post('/report/:postId', async (req, res) => {
    try {
        const postId = req.params.postId;
        const userId = req.body.userId; // Assuming user ID is sent in the request body
        const reason = req.body.reason;
        const result = await reportPost(postId, userId, reason);
        res.status(200).json({ message: 'Post reported successfully', result });
    } catch (error) {
        res.status(500).json({ message: 'Error reporting post', error });
    }
});

export default router;