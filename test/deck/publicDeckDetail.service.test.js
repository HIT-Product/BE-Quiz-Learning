import assert from 'node:assert/strict'
import { afterEach, describe, test } from 'node:test'

import { DECK_VISIBILITY } from '../../src/constants/index.js'
import { deckModel, flashcardModel, userModel } from '../../src/models/index.js'
import deckService from '../../src/services/client/deck.service.js'

const originalFindOne = deckModel.findOne
const originalFindCards = flashcardModel.find
const originalFindUser = userModel.findById

afterEach(() => {
  deckModel.findOne = originalFindOne
  flashcardModel.find = originalFindCards
  userModel.findById = originalFindUser
})

describe('deckService.getPublicById', () => {
  test('trả metadata, tác giả và danh sách thẻ đã sắp thứ tự', async () => {
    const deck = {
      _id: 'deck-1',
      ownerId: 'owner-1',
      title: 'Public deck',
      visibility: DECK_VISIBILITY.PUBLIC,
      cardCount: 99
    }
    const owner = { _id: 'owner-1', displayName: 'Nguyễn An', avatarUrl: null }
    const cards = [
      { _id: 'card-1', front: 'A', back: 'B', sortOrder: 1 },
      { _id: 'card-2', front: 'C', back: 'D', sortOrder: 2 }
    ]
    let deckFilter
    let cardFilter
    let cardSort

    deckModel.findOne = (filter) => {
      deckFilter = filter
      return { lean: async () => deck }
    }
    userModel.findById = (id) => {
      assert.equal(id, deck.ownerId)
      return { select: () => ({ lean: async () => owner }) }
    }
    flashcardModel.find = (filter) => {
      cardFilter = filter
      return {
        sort: (sort) => {
          cardSort = sort
          return { select: () => ({ lean: async () => cards }) }
        }
      }
    }

    const result = await deckService.getPublicById(deck._id)

    assert.deepEqual(deckFilter, { _id: deck._id, visibility: DECK_VISIBILITY.PUBLIC })
    assert.deepEqual(cardFilter, { deckId: deck._id })
    assert.deepEqual(cardSort, { sortOrder: 1, createdAt: 1 })
    assert.equal(result.owner, owner)
    assert.equal(result.cards, cards)
    assert.equal(result.cardCount, cards.length)
  })

  test('không trả deck riêng tư hoặc không tồn tại', async () => {
    deckModel.findOne = () => ({ lean: async () => null })

    await assert.rejects(deckService.getPublicById('private-deck'), (error) => {
      assert.equal(error.statusCode, 404)
      return true
    })
  })
})
