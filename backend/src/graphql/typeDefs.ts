export const typeDefs = `#graphql
  type User {
    id: ID!
    email: String!
    name: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  enum Role {
    VIEWER
    EDITOR
  }

  enum BoardTemplate {
    SPRINT
    PERSONAL
    BUG_TRACKER
  }

  type Collaborator {
    user: User!
    role: Role!
  }

  type Board {
    id: ID!
    name: String!
    owner: User!
    collaborators: [Collaborator!]!
    myRole: Role
    createdAt: String!
  }

  type Task {
    id: ID!
    title: String!
    description: String
    column: Column!
    board: Board!
    assignee: User
    order: Int!
    dueDate: String
    priority: Priority!
    labels: [Label!]!
    createdAt: String!
  }

  enum Column {
    TODO
    IN_PROGRESS
    DONE
  }

  enum Priority {
    LOW
    MEDIUM
    HIGH
  }

  type Label {
    id: ID!
    name: String!
    color: String!
  }

  type Comment {
    id: ID!
    task: ID!
    author: User!
    text: String!
    createdAt: String!
  }

  type ActivityEntry {
    id: ID!
    user: User!
    text: String!
    createdAt: String!
  }

  type Attachment {
    id: ID!
    task: ID!
    uploader: User!
    url: String!
    filename: String!
    fileType: String!
    createdAt: String!
  }

  type Notification {
    id: ID!
    text: String!
    boardId: String!
    read: Boolean!
    createdAt: String!
  }

  type Query {
    me: User
    boards: [Board!]!
    board(id: ID!): Board
    boardCollaborators(boardId: ID!): [Collaborator!]!
    tasks(boardId: ID!): [Task!]!
    comments(taskId: ID!): [Comment!]!
    activityLog(boardId: ID!): [ActivityEntry!]!
    boardLabels(boardId: ID!): [Label!]!
    myNotifications: [Notification!]!
    taskAttachments(taskId: ID!): [Attachment!]!
  }

  type Mutation {
    register(email: String!, password: String!, name: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createBoard(name: String!): Board!
    deleteBoard(id: ID!): Boolean!
    inviteCollaborator(boardId: ID!, email: String!, role: Role!): Board!
    removeCollaborator(boardId: ID!, userId: ID!): Board!
    createTask(boardId: ID!, title: String!, description: String, column: Column, dueDate: String, priority: Priority, labelIds: [ID!]): Task!
    moveTask(taskId: ID!, column: Column!): Task!
    updateTask(taskId: ID!, title: String, description: String, dueDate: String, assigneeId: ID, priority: Priority, labelIds: [ID!]): Task!
    createLabel(boardId: ID!, name: String!, color: String!): Label!
    deleteLabel(labelId: ID!): Boolean!
    deleteTask(taskId: ID!): Boolean!
    addComment(taskId: ID!, text: String!): Comment!
    deleteComment(commentId: ID!): Boolean!
    markNotificationsRead: Boolean!
    deleteAttachment(attachmentId: ID!): Boolean!
    createBoardFromTemplate(name: String!, template: BoardTemplate!): Board!
  }

  type Subscription {
    taskCreated(boardId: ID!): Task!
    taskMoved(boardId: ID!): Task!
    taskDeleted(boardId: ID!): ID!
    taskUpdated(boardId: ID!): Task!
    boardCreated(ownerId: ID!): Board!
    boardDeleted(ownerId: ID!): ID!
    collaboratorsChanged(userId: ID!): ID!
    commentAdded(boardId: ID!): Comment!
    activityAdded(boardId: ID!): ActivityEntry!
    labelChanged(boardId: ID!): ID!
    notificationAdded(userId: ID!): Notification!
  }
`;
