import { gql } from "@apollo/client";

export const REGISTER = gql`
  mutation Register($email: String!, $password: String!, $name: String!) {
    register(email: $email, password: $password, name: $name) {
      token
      user { id email name }
    }
  }
`;

export const LOGIN = gql`
  mutation Login($email: String!, $password: String!) {
    login(email: $email, password: $password) {
      token
      user { id email name }
    }
  }
`;

export const ME = gql`
  query Me {
    me { id email name }
  }
`;

export const GET_BOARDS = gql`
  query GetBoards {
    boards {
      id name createdAt myRole
      owner { id }
      collaborators { user { id name email } role }
    }
  }
`;

export const CREATE_BOARD = gql`
  mutation CreateBoard($name: String!) {
    createBoard(name: $name) {
      id name createdAt myRole
      owner { id }
      collaborators { user { id name email } role }
    }
  }
`;

export const CREATE_BOARD_FROM_TEMPLATE = gql`
  mutation CreateBoardFromTemplate($name: String!, $template: BoardTemplate!) {
    createBoardFromTemplate(name: $name, template: $template) {
      id name createdAt myRole
      owner { id }
      collaborators { user { id name email } role }
    }
  }
`;

export const DELETE_BOARD = gql`
  mutation DeleteBoard($id: ID!) {
    deleteBoard(id: $id)
  }
`;

export const GET_TASKS = gql`
  query GetTasks($boardId: ID!) {
    tasks(boardId: $boardId) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($boardId: ID!, $title: String!, $description: String, $column: Column, $dueDate: String, $priority: Priority, $labelIds: [ID!]) {
    createTask(boardId: $boardId, title: $title, description: $description, column: $column, dueDate: $dueDate, priority: $priority, labelIds: $labelIds) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const MOVE_TASK = gql`
  mutation MoveTask($taskId: ID!, $column: Column!) {
    moveTask(taskId: $taskId, column: $column) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($taskId: ID!, $title: String, $description: String, $dueDate: String, $assigneeId: ID, $priority: Priority, $labelIds: [ID!]) {
    updateTask(taskId: $taskId, title: $title, description: $description, dueDate: $dueDate, assigneeId: $assigneeId, priority: $priority, labelIds: $labelIds) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const DELETE_TASK = gql`
  mutation DeleteTask($taskId: ID!) {
    deleteTask(taskId: $taskId)
  }
`;

export const TASK_CREATED_SUB = gql`
  subscription TaskCreated($boardId: ID!) {
    taskCreated(boardId: $boardId) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const TASK_MOVED_SUB = gql`
  subscription TaskMoved($boardId: ID!) {
    taskMoved(boardId: $boardId) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const TASK_DELETED_SUB = gql`
  subscription TaskDeleted($boardId: ID!) {
    taskDeleted(boardId: $boardId)
  }
`;

export const TASK_UPDATED_SUB = gql`
  subscription TaskUpdated($boardId: ID!) {
    taskUpdated(boardId: $boardId) {
      id title description column order dueDate priority createdAt assignee { id name } labels { id name color }
    }
  }
`;

export const BOARD_CREATED_SUB = gql`
  subscription BoardCreated($ownerId: ID!) {
    boardCreated(ownerId: $ownerId) {
      id name createdAt
    }
  }
`;

export const BOARD_DELETED_SUB = gql`
  subscription BoardDeleted($ownerId: ID!) {
    boardDeleted(ownerId: $ownerId)
  }
`;

export const COLLABS_CHANGED_SUB = gql`
  subscription CollaboratorsChanged($userId: ID!) {
    collaboratorsChanged(userId: $userId)
  }
`;

export const GET_BOARD_LABELS = gql`
  query GetBoardLabels($boardId: ID!) {
    boardLabels(boardId: $boardId) { id name color }
  }
`;

export const CREATE_LABEL = gql`
  mutation CreateLabel($boardId: ID!, $name: String!, $color: String!) {
    createLabel(boardId: $boardId, name: $name, color: $color) { id name color }
  }
`;

export const DELETE_LABEL = gql`
  mutation DeleteLabel($labelId: ID!) {
    deleteLabel(labelId: $labelId)
  }
`;

export const GET_ACTIVITY_LOG = gql`
  query GetActivityLog($boardId: ID!) {
    activityLog(boardId: $boardId) {
      id text createdAt
      user { id name }
    }
  }
`;

export const ACTIVITY_ADDED_SUB = gql`
  subscription ActivityAdded($boardId: ID!) {
    activityAdded(boardId: $boardId) {
      id text createdAt
      user { id name }
    }
  }
`;

export const GET_COMMENTS = gql`
  query GetComments($taskId: ID!) {
    comments(taskId: $taskId) {
      id task text createdAt
      author { id name }
    }
  }
`;

export const ADD_COMMENT = gql`
  mutation AddComment($taskId: ID!, $text: String!) {
    addComment(taskId: $taskId, text: $text) {
      id task text createdAt
      author { id name }
    }
  }
`;

export const DELETE_COMMENT = gql`
  mutation DeleteComment($commentId: ID!) {
    deleteComment(commentId: $commentId)
  }
`;

export const GET_ATTACHMENTS = gql`
  query GetAttachments($taskId: ID!) {
    taskAttachments(taskId: $taskId) {
      id task url filename fileType createdAt
      uploader { id name }
    }
  }
`;

export const DELETE_ATTACHMENT = gql`
  mutation DeleteAttachment($attachmentId: ID!) {
    deleteAttachment(attachmentId: $attachmentId)
  }
`;

export const GET_NOTIFICATIONS = gql`
  query GetNotifications {
    myNotifications { id text boardId read createdAt }
  }
`;

export const MARK_NOTIFICATIONS_READ = gql`
  mutation MarkNotificationsRead {
    markNotificationsRead
  }
`;

export const NOTIFICATION_ADDED_SUB = gql`
  subscription NotificationAdded($userId: ID!) {
    notificationAdded(userId: $userId) { id text boardId read createdAt }
  }
`;

export const LABEL_CHANGED_SUB = gql`
  subscription LabelChanged($boardId: ID!) {
    labelChanged(boardId: $boardId)
  }
`;

export const COMMENT_ADDED_SUB = gql`
  subscription CommentAdded($boardId: ID!) {
    commentAdded(boardId: $boardId) {
      id task text createdAt
      author { id name }
    }
  }
`;

export const GET_BOARD_COLLABORATORS = gql`
  query GetBoardCollaborators($boardId: ID!) {
    boardCollaborators(boardId: $boardId) {
      user { id name email }
      role
    }
  }
`;

export const INVITE_COLLABORATOR = gql`
  mutation InviteCollaborator($boardId: ID!, $email: String!, $role: Role!) {
    inviteCollaborator(boardId: $boardId, email: $email, role: $role) {
      id collaborators { user { id name email } role }
    }
  }
`;

export const REMOVE_COLLABORATOR = gql`
  mutation RemoveCollaborator($boardId: ID!, $userId: ID!) {
    removeCollaborator(boardId: $boardId, userId: $userId) {
      id collaborators { user { id name email } role }
    }
  }
`;
