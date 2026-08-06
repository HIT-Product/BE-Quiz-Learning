import { Router } from 'express'

import userRouter from './user.route.js'
import authRouter from './auth.route.js'
import folderRouter from './folder.route.js'
import deckRouter from './deck.route.js'
import flashcardRouter from './flashcard.route.js'
import quizRouter from './quiz.route.js'
import learnRouter from './learn.route.js'
import studyRouter from './study.route.js'
import studyRoomRouter from './studyRoom.route.js'
import dashboardRouter from './dashboard.route.js'
import friendRouter from './friend.route.js'
import blockRouter from './block.route.js'
import conversationRouter from './conversation.route.js'
import feedRouter from './feed.route.js'

const clientRouter = Router()

clientRouter.use('/users', userRouter)
clientRouter.use('/auth', authRouter)
clientRouter.use('/folders', folderRouter)
clientRouter.use('/decks/:deckId/cards', flashcardRouter)
clientRouter.use('/decks/:deckId/quiz', quizRouter)
clientRouter.use('/decks/:deckId/learn', learnRouter)
clientRouter.use('/decks/:deckId/study', studyRouter)
clientRouter.use('/decks', deckRouter)
clientRouter.use('/study-rooms', studyRoomRouter)
clientRouter.use('/friends', friendRouter)
clientRouter.use('/blocks', blockRouter)
clientRouter.use('/conversations', conversationRouter)
clientRouter.use('/feed', feedRouter)
clientRouter.use('/dashboard', dashboardRouter)

export default clientRouter
