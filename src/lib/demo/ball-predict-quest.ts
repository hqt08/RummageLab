import { findLearningFocus } from "../data/learning-focuses";
import {
  QuestSpecSchema,
  type ActivityContext,
  type QuestSpec,
  type RummageToolSpec,
} from "../schemas";

export const BALL_PREDICT_TEMPLATE_ID = "ball-roll-predictions" as const;
export const BALL_PREDICT_REQUIRED_MATERIAL = "large_soft_ball" as const;

const rawBallPredictQuest = {
  id: BALL_PREDICT_TEMPLATE_ID,
  title: "Ball Roll Predictions",
  experienceMode: "guided_quest",
  ageStage: "3-4y",
  developmentalFocusIds: [
    "DEV.COG.CAUSE_EFFECT",
    "DEV.LANG.DESCRIPTIVE_WORDS",
    "DEV.SOC.TURN_TAKING",
  ],
  parentFacingGoal:
    "Make a simple prediction, try one gentle ball roll, and notice what changed together.",
  materials: [BALL_PREDICT_REQUIRED_MATERIAL],
  adultSafetyNote:
    "Stay within arm’s reach. Use one soft ball that is too large to fit in a child’s mouth, roll it only on a clear floor, and stop before stairs, doors, pets, or breakable things.",
  stopIf: [
    "The ball could roll toward stairs, a doorway, pets, or breakable things.",
    "The space is not clear or the play stops feeling calm.",
  ],
  steps: [
    {
      minute: 0,
      instruction:
        "Point to the clear floor. Ask: will the soft ball roll near, medium, or far? Let your child choose a picture.",
    },
    {
      minute: 2,
      instruction:
        "A grown-up rolls the ball gently once. Watch together until it stops.",
    },
    {
      minute: 4,
      instruction:
        "Compare the prediction with what happened: was it nearer, farther, or about the same? Any answer is a noticing answer.",
    },
    {
      minute: 6,
      instruction:
        "Switch turns: your child points to a prediction, then the grown-up makes one gentle roll.",
    },
  ],
  evidencePrompt:
    "What did your child point to, say, or notice about where the ball stopped?",
  parentReflectionPrompt:
    "What did you notice during the ball play? You can skip this step.",
  tool: {
    kind: "predict",
    title: "Where will it stop?",
    prompt: "Choose a picture prediction, then try one gentle roll with a grown-up.",
    accessibilityHint:
      "Each large prediction button uses words as well as a simple visual symbol; choosing one records nothing.",
    question: "Where do you think the soft ball will stop?",
    options: ["Near us", "In the middle", "Farther away"],
  },
  fallbackMessage:
    "Point to near, middle, or far; make one gentle grown-up roll; then notice together where the ball stopped.",
};

export type PredictToolSpec = Extract<RummageToolSpec, { kind: "predict" }>;
export type BallPredictQuest = QuestSpec & {
  id: typeof BALL_PREDICT_TEMPLATE_ID;
  ageStage: "3-4y";
  tool: PredictToolSpec;
};

/** This reviewed template is appropriate only for the narrow 3–4 indoor context. */
export function canUseBallPredictTemplate(context: ActivityContext): boolean {
  return (
    context.ageStage === "3-4y" &&
    context.setting === "indoors" &&
    context.availableMinutes >= 8 &&
    context.availableMinutes <= 12 &&
    context.parentConfirmedSafety &&
    context.confirmedMaterials.some(
      (material) => material.allowedMaterialCategory === BALL_PREDICT_REQUIRED_MATERIAL && material.parentConfirmed,
    )
  );
}

export function parseBallPredictQuest(
  input: unknown,
  activityContext: ActivityContext,
): BallPredictQuest {
  const quest = QuestSpecSchema.parse(input);
  if (quest.id !== BALL_PREDICT_TEMPLATE_ID || quest.ageStage !== "3-4y") {
    throw new Error("Ball Roll Predictions must remain the reviewed 3–4 year template");
  }
  if (!canUseBallPredictTemplate(activityContext)) {
    throw new Error("Ball Roll Predictions requires a parent-confirmed large soft ball in the reviewed indoor context");
  }
  if (quest.tool.kind !== "predict" || quest.materials.length !== 1 || quest.materials[0] !== BALL_PREDICT_REQUIRED_MATERIAL) {
    throw new Error("Ball Roll Predictions may render only its approved predict tool and large soft ball material");
  }
  if (quest.steps.some((step) => step.minute > activityContext.availableMinutes)) {
    throw new Error("Ball Roll Predictions steps must fit the parent-approved time window");
  }
  if (quest.developmentalFocusIds.some((id) => !findLearningFocus(id))) {
    throw new Error("Ball Roll Predictions contains an unapproved developmental focus");
  }
  return quest as BallPredictQuest;
}

export const ballPredictQuest = parseBallPredictQuest(rawBallPredictQuest, {
  ageStage: "3-4y",
  materialSource: "typed",
  confirmedMaterials: [{ allowedMaterialCategory: BALL_PREDICT_REQUIRED_MATERIAL, parentConfirmed: true }],
  weather: { source: "seeded_demo", approvedTags: ["rainy"], parentApproved: true, preciseLocationStored: false },
  availableMinutes: 8,
  setting: "indoors",
  parentConfirmedSafety: true,
});
