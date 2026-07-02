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
  },
  {
    timestamps: true,
  }
);

module.exports = model("Match", matchSchema);