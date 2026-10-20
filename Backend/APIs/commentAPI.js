// commentAPI routes: Express endpoints for this backend resource.
import express from 'express'
import {
  createComment,
  getCommentsByTask,
  updateComment,
  deleteComment
} from '../controllers/commentController.js'
import { verifyRolesToken } from '../middlewares/verifyRolesToken.js'

export const commentApp = express.Router()

const auth = verifyRolesToken('MEMBER', 'ADMIN', 'MANAGER', 'VIEWER')

//create comment
commentApp.post('/comment', auth, createComment)

//get comments by task
commentApp.get('/comment/:taskId', auth, getCommentsByTask)

//update comment
commentApp.put('/comment/:id', auth, updateComment)

//delete comment
commentApp.delete('/comment/:id', auth, deleteComment)


