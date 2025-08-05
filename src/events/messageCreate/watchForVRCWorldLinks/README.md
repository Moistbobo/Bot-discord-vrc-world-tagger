# Watch For VRC World Links Module

This module handles the detection and processing of VRC world links in Discord messages.

## Structure

```
watchForVRCWorldLinks/
├── index.ts      # Main entry point with the primary function
├── util.ts       # Utility functions for world processing
└── README.md     # This documentation
```

## Files

### `index.ts`
The main entry point that orchestrates the world link processing workflow:
- Checks if the channel is being watched
- Extracts world IDs from messages
- Coordinates the processing pipeline
- Handles error logging

### `util.ts`
Contains all utility functions organized by responsibility:

#### World Data Processing
- `extractWorldIdFromMessage()` - Extracts world IDs from direct links or Twitter links
- `fetchWorldData()` - Fetches world data from VRChat API
- `calculatePackageSizes()` - Calculates file sizes for all supported platforms

#### Discord Integration
- `createWorldEmbed()` - Creates Discord embed with world information
- `forwardToChannel()` - Forwards world info to specific channels
- `sendResponse()` - Sends response to original message

#### Database Operations
- `markWorldAsProcessed()` - Adds world to processed list in database
- `getForwardingChannels()` - Determines which channels to forward to

#### Constants & Types
- `PLAYER_CAPACITY_THRESHOLD` - Threshold for player capacity forwarding (60)
- `ForwardingChannel` - Interface for forwarding channel configuration

## Workflow

1. **Channel Check**: Verifies if the message channel is being watched
2. **World ID Extraction**: Extracts world ID from message content or Twitter links
3. **Data Fetching**: Retrieves world data from VRChat API
4. **Processing**: Calculates package sizes and determines supported platforms
5. **Embed Creation**: Creates Discord embed with world information
6. **Forwarding**: Determines and forwards to appropriate channels based on criteria
7. **Response**: Sends response to original message

## Forwarding Criteria

- **Android Support**: Forwards to Android forwarding channel if world supports Android
- **Player Capacity**: Forwards to player count channel if capacity >= 60 players

## Error Handling

- Comprehensive try-catch blocks around all async operations
- Detailed error logging for debugging
- Graceful fallbacks for failed operations
- Channel availability checks before forwarding

## Dependencies

- Discord.js for message handling and embeds
- VRChat API for world data
- Custom database utilities for persistence
- External APIs for Twitter link processing 