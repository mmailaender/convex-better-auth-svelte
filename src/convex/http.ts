import { httpRouter } from 'convex/server'
import { betterAuthComponent } from './auth.js'
import { createAuth } from '../lib/auth.js'

const http = httpRouter()

betterAuthComponent.registerRoutes(http, createAuth)

export default http