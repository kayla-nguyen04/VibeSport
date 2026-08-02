const { Schema, model } = require("mongoose");

const positionSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
    },
    label: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const matchSchema = new Schema(
  {
    sport: {
      type: String,
      enum: ["football", "badminton", "pickleball"],
      required: true,
    },

    formation: {
      type: String,
      enum: ["5v5", "7v7", "9v9", "11v11", "1v1", "2v2"],
      default: "11v11",
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    date: {
      type: String,
      required: true,
    },

    startTime: {
      type: String,
      required: true,
    },

    maxPlayers: {
      type: Number,
      required: true,
      min: 1,
    },

    currentPlayers: {
      type: Number,
      default: 1,
      min: 0,
    },

    positionsNeeded: {
      type: [positionSchema],
      default: [],
    },

    costPerPerson: {
      type: Number,
      default: 0,
      min: 0,
    },

    locationName: {
      type: String,
      required: true,
      trim: true,
    },

    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
      address: {
        type: String,
        default: "",
      },
    },

    note: {
      type: String,
      default: "",
      maxlength: 200,
    },

    contactPhone: {
      type: String,
      default: "",
    },

    contactZalo: {
      type: String,
      default: "",
    },

    contactFacebook: {
      type: String,
      default: "",
    },

    contactAppUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    courtDescription: {
      type: String,
      default: "",
    },

    specificAddress: {
      type: String,
      default: "",
    },

    endTime: {
      type: String,
      default: "20:30",
    },

    time: {
      type: String,
      default: "19:00 - 20:30",
    },

    totalHours: {
      type: Number,
      default: 1.5,
    },

    totalCourtCost: {
      type: Number,
      default: 450000,
    },

    costPerPlayer: {
      type: Number,
      default: 45000,
    },

    skillLevel: {
      type: String,
      default: "Người mới",
    },

    serviceCost: {
      type: Schema.Types.Mixed,
      default: "",
    },

    selectedPositionIds: {
      type: [String],
      default: [],
    },

    footballFormation: {
      type: String,
      default: "",
    },

    benchMembersTeam1: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },

    benchMembersTeam2: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    chatGroupId: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      default: null,
    },

    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pendingJoinRequests: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pendingJoinRequestPositions: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        positionIds: {
          type: [String],
          default: [],
        },
      },
    ],

    pendingInviteRequests: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        invitedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        requiresOwnerApproval: {
          type: Boolean,
          default: false,
        },
      },
    ],

    invitedMembers: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["open", "full", "cancelled", "completed"],
      default: "open",
    },

    teamStatus: {
      type: String,
      enum: ["not_started", "ongoing", "paused", "ended"],
      default: "not_started",
    },

    notifiedStart30Min: {
      type: Boolean,
      default: false,
    },

    memberRoles: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["owner", "member"],
          default: "member",
        },
      },
    ],

    memberPositions: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
        },
        positionId: {
          type: String,
          default: "",
        },
      },
    ],

    deletionVote: {
      active: { type: Boolean, default: false },
      requestedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      acceptedUsers: [{ type: Schema.Types.ObjectId, ref: "User", default: [] }],
    },
  },
  {
    timestamps: true,
  }
);

matchSchema.post('save', function (doc) {
  if (global.io) {
    global.io.emit('match_updated', { matchId: doc._id.toString() });
  }
});

matchSchema.post('findOneAndDelete', function (doc) {
  if (doc && global.io) {
    global.io.emit('match_updated', { matchId: doc._id.toString(), isDeleted: true });
  }
});

module.exports = model("Match", matchSchema);