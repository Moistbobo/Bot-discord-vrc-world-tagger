# JSON Database Module

This module provides a simple key-value database interface using JSON file storage with the `keyv-file` package.

## Files

- `index.ts` - Database initialization and safe wrapper methods
- `types.ts` - Type definitions and database keys
- `getSetValue.ts` - Database operation functions
- `README.md` - This documentation

## Features

### Error Handling
All database operations now include comprehensive error handling with:
- Try-catch blocks around all operations
- Detailed error logging
- Graceful fallbacks for failed operations
- Return types that indicate success/failure

### Type Safety
- Full TypeScript support with proper type annotations
- Generic type support for different data types
- Enum-based key management to prevent typos

### Database Operations

#### List Operations
- `addItemToList()` - Add an item to a list with optional duplicate checking
- `removeItemFromList()` - Remove an item from a list
- `isItemInList()` - Check if an item exists in a list
- `getFirstItemInList()` - Get the first item from a list
- `getAllItemsFromList()` - Get all items from a list
- `replaceListWithItem()` - Replace entire list with a single item

#### Utility Operations
- `wipeValuesForKey()` - Completely remove all data for a key

### Database Keys

The following keys are available for storing different types of data:

- `WATCHED_CHANNELS` - Channels being watched for VRC world links
- `PLAYER_COUNT_FORWARDING_CHANNEL` - Channel for forwarding player count updates
- `ANDROID_FORWARDING_CHANNEL` - Channel for forwarding Android support messages
- `PROCESSED_WORLDS` - Worlds that have been processed to avoid duplicates

### Return Types

All database operations now return a `DbOperationResult` type:

```typescript
type DbOperationResult = {
  success: boolean;
  error?: string;
};
```

This allows calling code to handle failures gracefully and provide appropriate user feedback.

## Usage Example

```typescript
import { addItemToList, isItemInList } from './getSetValue';
import { kvKeys } from './types';

// Add a channel to watch list
const result = await addItemToList(kvKeys.WATCHED_CHANNELS, channelId);
if (result.success) {
  console.log('Channel added successfully');
} else {
  console.error('Failed to add channel:', result.error);
}

// Check if channel is being watched
const isWatched = await isItemInList(kvKeys.WATCHED_CHANNELS, channelId);
```

## Improvements Made

1. **Error Handling**: Added comprehensive error handling with try-catch blocks
2. **Type Safety**: Improved TypeScript types and added proper return types
3. **Documentation**: Added JSDoc comments for all functions
4. **Code Organization**: Better separation of concerns and helper functions
5. **Flexibility**: Configurable database file path
6. **Reliability**: Safe wrapper methods that handle errors gracefully
7. **User Feedback**: Functions now return success/failure status for better UX 