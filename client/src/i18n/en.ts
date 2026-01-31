export const en = {
    // App general
    app: {
        title: 'RetroFlow',
        subtitle: 'Real-time Agile Retrospectives',
        loading: 'Loading...',
        error: 'Error',
        success: 'Success',
        cancel: 'Cancel',
        confirm: 'Confirm',
        save: 'Save',
        delete: 'Delete',
        edit: 'Edit',
        close: 'Close',
        back: 'Back',
        next: 'Next',
        previous: 'Previous',
    },

    // Auth
    auth: {
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        email: 'Email',
        password: 'Password',
        name: 'Name',
        confirmPassword: 'Confirm Password',
        forgotPassword: 'Forgot Password?',
        noAccount: "Don't have an account?",
        hasAccount: 'Already have an account?',
        loginError: 'Invalid email or password',
        registerError: 'Registration failed',
        orContinueAsGuest: 'Or continue as guest',
    },

    // Dashboard
    dashboard: {
        welcome: 'Welcome to RetroFlow',
        createRoom: 'Create a Retrospective',
        joinRoom: 'Join a Retrospective',
        myRetros: 'My Retrospectives',
        roomName: 'Room Name',
        yourName: 'Your Name',
        template: 'Template',
        roomCode: 'Room Code',
        password: 'Password (optional)',
        maxPostits: 'Max post-its per person',
        advancedOptions: 'Advanced Options',
        create: 'Create',
        join: 'Join',
        templates: {
            madSadGlad: 'Mad Sad Glad',
            startStopContinue: 'Start Stop Continue',
            fourLs: '4Ls (Liked, Learned, Lacked, Longed)',
            sailboat: 'Sailboat',
        },
    },

    // Room
    room: {
        participants: 'Participants',
        online: 'online',
        offline: 'offline',
        facilitator: 'Facilitator',
        participant: 'Participant',
        observer: 'Observer',
        copyLink: 'Copy Link',
        linkCopied: 'Link copied!',
        leaveRoom: 'Leave Room',
        deleteRoom: 'Delete Room',
        closeRoom: 'Close Room',
        reopenRoom: 'Reopen Room',
        roomClosed: 'This room is closed',
        confirmDelete: 'Are you sure you want to delete this room? This action cannot be undone.',
        confirmLeave: 'Are you sure you want to leave this room?',
    },

    // Phases
    phases: {
        SETUP: 'Setup',
        IDEATION: 'Ideation',
        DISCUSSION: 'Discussion',
        GROUPING: 'Grouping',
        VOTING: 'Voting',
        ACTIONS: 'Actions',
        CONCLUSION: 'Summary',
    },

    // Phase tutorials
    tutorials: {
        SETUP: {
            title: 'Welcome to the Retrospective!',
            description: 'Take a moment to get settled. The facilitator will explain the purpose of this session and set the stage for open, honest feedback.',
            tips: [
                'Review the columns and understand what each represents',
                'Think about the recent sprint or period',
                'Prepare to share your thoughts openly',
            ],
        },
        IDEATION: {
            title: 'Time to Share Your Ideas!',
            description: "Add your thoughts to each column. Don't worry, your ideas are hidden from others until the reveal phase. Be honest and specific.",
            tips: [
                'Click the + button to add a new post-it',
                'One idea per post-it works best',
                'Your ideas are private until revealed',
                'No idea is too small or too big',
            ],
        },
        DISCUSSION: {
            title: "Let's Discuss Together",
            description: 'Now all ideas are visible! The facilitator will guide the discussion. Listen actively and build on each other\'s thoughts.',
            tips: [
                'The facilitator can focus on specific items',
                'Clarify your ideas if asked',
                'Listen without interrupting',
                'Ask questions to understand better',
            ],
        },
        GROUPING: {
            title: 'Organize by Topics',
            description: 'Drag similar ideas together into topics. This helps identify patterns and prioritize what to discuss further.',
            tips: [
                'Create topics using the input above',
                'Drag post-its from the sidebar to topics',
                'Similar ideas can be grouped together',
                'Topics can be renamed by clicking on them',
            ],
        },
        VOTING: {
            title: 'Vote for Priorities',
            description: 'You have 3 votes to allocate. Vote for the topics you think are most important to address.',
            tips: [
                'Click + to add a vote, - to remove',
                'You can put multiple votes on one topic',
                'Results appear when everyone has voted',
                'Vote for impact, not just agreement',
            ],
        },
        ACTIONS: {
            title: 'Discuss Topics & Define Actions',
            description: "Work through topics one by one, starting with the most voted. Discuss each topic and define concrete action items before moving to the next.",
            tips: [
                'Topics are ordered by vote count',
                'Discuss the ideas related to each topic',
                'Define specific, assignable actions',
                'Click "Complete" to move to the next topic',
            ],
        },
        CONCLUSION: {
            title: 'Retrospective Summary',
            description: "Here's a summary of your retrospective. Review the action items and make sure everyone is aligned on next steps.",
            tips: [
                'Review all action items',
                'Confirm owners and deadlines',
                'Thank everyone for participating',
                'Schedule follow-up if needed',
            ],
        },
        gotIt: 'Got it!',
        showAgain: 'Show tips',
        dontShowAgain: "Don't show again",
    },

    // Board
    board: {
        addPostit: 'Add a post-it',
        writeIdea: 'Write your idea...',
        hiddenIdea: 'Hidden idea',
        revealIdeas: 'Reveal Ideas',
        toSort: 'To Sort',
        allSorted: 'All ideas are sorted!',
        createTopic: 'Create Topic',
        topicName: 'New topic name (e.g., Tools, Process, Communication)...',
        deleteTopic: 'Delete this topic? Post-its will be moved back to the sort list.',
        votes: 'votes',
        votesRemaining: 'votes remaining',
        waitingForVotes: 'Waiting for others...',
        resultsRevealed: 'Results revealed!',
        breakTie: 'Break tie',
        confirmTieBreak: 'This will reset votes for tied topics. Continue?',
        ideasForTopic: 'Ideas for this topic',
    },

    // Actions
    actions: {
        title: 'Actions',
        decidedActions: 'Decided Actions',
        linkedActions: 'Actions',
        newAction: 'Add an action item...',
        assignee: 'Assignee',
        team: 'Team',
        noActions: 'No actions for this topic',
        add: 'Add',
        completeAndNext: 'Complete & Next Topic',
        completeTopic: 'Complete Topic',
        upNext: 'Up Next',
        completed: 'Completed',
        allTopicsCompleted: 'All topics completed!',
        totalActions: 'Total action items defined',
        reviewTopics: 'Click a topic to review',
    },

    // Timer
    timer: {
        start: 'Start Timer',
        stop: 'Stop',
        timeUp: "Time's up!",
    },

    // My Retros
    myRetros: {
        title: 'My Retrospectives',
        all: 'All',
        active: 'Active',
        closed: 'Closed',
        noRetros: 'No retrospectives found',
        createFirst: 'Create your first retrospective',
        status: {
            active: 'Active',
            closed: 'Closed',
            archived: 'Archived',
        },
    },

    // Errors
    errors: {
        roomNotFound: 'Room not found',
        invalidPassword: 'Invalid password',
        notAuthorized: 'You are not authorized to perform this action',
        connectionLost: 'Connection lost. Reconnecting...',
        maxPostitReached: 'Maximum number of post-its reached',
    },
};

export type Translations = typeof en;
