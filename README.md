# Task Management API

## Overview

This project is a Node.js and Express-based API for managing tasks. It provides a RESTful interface for creating, reading, updating, and deleting tasks, along with user authentication, user profile management, and robust tag management features. The API is designed to be user-centric, ensuring that users can only access and manage their own data. It uses SQLite as its database and includes a comprehensive suite of automated tests.

## Features Implemented

*   **User Authentication**:
    *   User registration (`/auth/register`)
    *   User login (`/auth/login`) with JWT-based authentication.
*   **User Profile Management**:
    *   Get current user's profile (`/users/me`)
    *   Update current user's profile (e.g., email) (`/users/me`)
    *   Change current user's password (`/users/me/change-password`)
*   **Task Management (CRUD)**:
    *   Create new tasks with optional descriptions and tags (`/tasks`)
    *   Get a list of tasks with pagination, sorting, and filtering (`/tasks`)
        *   Filter by completion status (`completed=true/false`)
        *   Filter by tags (comma-separated, e.g., `tags=work,urgent`)
        *   Tag matching mode (`tagMatchMode=all` or `tagMatchMode=any`)
        *   Sort by fields like `createdAt`, `updatedAt`, `title`, `completed` (e.g., `sortBy=createdAt_DESC`)
    *   Get a specific task by ID (`/tasks/{id}`)
    *   Update an existing task (title, description, completion status, tags) (`/tasks/{id}`)
    *   Delete a task (`/tasks/{id}`)
*   **Tag Management**:
    *   List all tags used by the authenticated user (`/tags`)
    *   Update a tag's name (globally, but permissioned by user association) (`/tags/{id}`)
    *   Delete a tag (globally, if not in use by any task, permissioned by user association) (`/tags/{id}`)
    *   Autocomplete tags for the authenticated user based on a query prefix (`/tags/autocomplete?q=...`)
        *   Option to show all user's tags if query is empty and `showAll=true` is passed.
*   **Database**: SQLite with schema for users, tasks, tags, and task-tag associations.
*   **Validation**: Robust input validation using Joi for request bodies and query parameters.
*   **Error Handling**: Centralized error handling middleware for consistent API responses.
*   **Testing**: Comprehensive unit and integration tests using Jest and Supertest.
*   **API Documentation**: Swagger/OpenAPI documentation available at `/api-docs`.

## Difficulties Faced & Overcome

1.  **User-Scoped Data Access**:
    *   **Challenge**: Ensuring users could only interact with their own tasks and see tags relevant to their tasks, while tags themselves could be global entities (e.g., a "work" tag has one ID but can be used by multiple users).
    *   **Solution**: Implemented strict `userId` checks in all service layer database queries for tasks. For tags, listing and autocomplete are scoped to the user's tasks. Tag updates/deletions are permissioned based on whether the user has tasks associated with that tag, and actual tag deletion from the global `tags` table only occurs if no user is using it.

2.  **Canonical Tag Management**:
    *   **Challenge**: Handling tags case-insensitively (e.g., "Work", "work", "WORK" should all refer to the same tag) and ensuring uniqueness.
    *   **Solution**: Tags are stored in a canonical (lowercase) format in the database. The `tags.name` column has a `UNIQUE COLLATE NOCASE` constraint. Service logic converts tag names to lowercase before database operations and comparisons. This ensures data integrity and consistent behavior for tag creation, lookup, and filtering.

3.  **Complex Task Filtering Logic**:
    *   **Challenge**: Implementing filtering of tasks by multiple tags with "match all" (`all`) and "match any" (`any`) modes, in combination with other filters like completion status.
    *   **Solution**: Developed dynamic SQL query building in the `taskService.js`. For `tagMatchMode=all`, `GROUP BY` and `HAVING COUNT(DISTINCT tag.name) = ?` clauses were used. For `tagMatchMode=any`, `EXISTS` or `IN` subqueries with joins were employed. Careful construction of `WHERE` clauses and parameter binding was necessary.

4.  **Database Schema Evolution & Integrity**:
    *   **Challenge**: Initial schema designs sometimes needed refinement to enforce data integrity (e.g., ensuring `userId` was correctly associated with tasks, handling tag uniqueness globally).
    *   **Solution**: Iteratively refined the database schema in `database.js`. Added `FOREIGN KEY` constraints with `ON DELETE CASCADE` for `task_tags` to automatically clean up associations when tasks or tags are deleted. Ensured `UNIQUE` constraints on `users.username`, `users.email`, and `tags.name`.

5.  **Comprehensive and Reliable Testing**:
    *   **Challenge**: Writing tests that cover various scenarios, including edge cases, authentication, and complex interactions between different modules (e.g., task creation affecting tag lists). Debugging test failures, such as those caused by SQLite column name case sensitivity or incorrect test data setup/teardown.
    *   **Solution**: Utilized Jest and Supertest for integration testing of API endpoints. Implemented `beforeAll`, `beforeEach`, and `afterAll` hooks for setting up and tearing down test data (e.g., `__clearTasksTableForTesting`, `__clearUsersTableForTesting`). Paid close attention to test isolation and ensuring that test expectations matched the actual (and correct) API behavior, especially after service logic changes.

## How to Use the API

### API Documentation

The primary way to explore and understand the API endpoints is through the Swagger documentation, which is automatically generated.

*   **Swagger Docs URL**: `http://localhost:<PORT>/api-docs` (e.g., `http://localhost:3000/api-docs` if running on port 3000)

This interactive documentation provides details on all available endpoints, request parameters, request bodies, and response schemas. You can also try out the API directly from the Swagger UI.

### General Principles

*   **Authentication**: Most endpoints (except `/auth/register` and `/auth/login`) require a JWT Bearer token in the `Authorization` header.
    `Authorization: <YOUR_JWT_TOKEN>`
*   **Content Type**: Requests with a body (POST, PUT) should use `application/json`.
*   **User Scope**: All task and user-specific tag operations are scoped to the authenticated user.

### Key Endpoints Summary

*   **Authentication**:
    *   `POST /auth/register`
    *   `POST /auth/login`
*   **Users**:
    *   `GET /users/me`
    *   `PUT /users/me`
    *   `POST /users/me/change-password`
*   **Tasks**:
    *   `POST /tasks`
    *   `GET /tasks` (with query params for filtering, sorting, pagination)
    *   `GET /tasks/{id}`
    *   `PUT /tasks/{id}`
    *   `DELETE /tasks/{id}`
*   **Tags**:
    *   `GET /tags`
    *   `PUT /tags/{id}`
    *   `DELETE /tags/{id}`
    *   `GET /tags/autocomplete` (with query params `q`, `limit`, `showAll`)

Refer to the Swagger documentation for detailed request/response structures.

## Setup & Running the Project

1.  **Clone the Repository**:
    ```bash
    git clone <your-repository-url>
    cd task-management-app
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Set Up Environment Variables**:
    Create a `.env` file in the root of the project by copying the example or creating a new one.
    ```
    // .env
    PORT=3000
    NODE_ENV=development
    DATABASE_PATH=./data/tasks.db
    JWT_SECRET=your_strong_jwt_secret_key_here
    JWT_EXPIRES_IN=1h
    ```
    *   `PORT`: The port the application will run on.
    *   `NODE_ENV`: Set to `development`, `production`, or `test`.
    *   `DATABASE_PATH`: Path to the SQLite database file. For testing, a separate `tasks.test.db` is typically used (configured internally).
    *   `JWT_SECRET`: A strong, random secret key for signing JWTs.
    *   `JWT_EXPIRES_IN`: How long JWTs are valid (e.g., `1h`, `7d`).

4.  **Run the Application**:
    ```bash
    npm start
    ```
    The API should now be running on the port specified in your `.env` file (default: 3000). The `data` directory and the SQLite database file (`tasks.db`) will be created automatically if they don't exist.

## Running Tests

The project uses Jest for testing.

To run all tests:
```bash
npm test
```
This command will execute all `*.test.js` files in the `tests` directory. Tests are run with `--runInBand` to ensure sequential execution, which can be helpful for tests involving database state.
The test environment uses a separate SQLite database (`./data/tasks.test.db`) to avoid interfering with development data.
```