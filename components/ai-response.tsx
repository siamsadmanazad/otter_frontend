import { ScrollArea } from "./ui/scroll-area";

import { MapPin, UtensilsCrossed } from "lucide-react";

interface IAnswerProps {
  places: string[];
  foods: string[];
  activities: string[];
  cautions: string[];
  commute: string[];
  enjoyment: string[];
}

export const AIResponse = ({ answer }: { answer: IAnswerProps }) => {
  if (!answer) {
    <div></div>;
  } else {
    return (
      <div className="h-[35vh] my-8 overflow-y-auto">
        <div>
          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700">
              <div className="flex flex-row gap-2">
                {" "}
                <MapPin /> Places to Visit
              </div>
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.places.map((place: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {place}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 mt-4">
              <div className="flex flex-row gap-2">
                {" "}
                <UtensilsCrossed /> Foods to Try
              </div>
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.foods.map((food: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {food}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 mt-4">
              🏃‍♂️ Best Activities
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.activities.map((activity: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {activity}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 mt-4">
              ⚠️ Stay Caution
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.cautions.map((caution: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {caution}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 mt-4">
              🚗 How to Travel?
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.commute.map((commute: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {commute}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-bold mb-4 border-b pb-2 border-gray-200 dark:border-gray-700 mt-4">
              🎉 Best Things to Enjoy 🎉
            </h2>
            <ul className="space-y-2 list-disc pl-5">
              {answer.enjoyment.map((enjoyment: string, index: number) => (
                <li
                  key={index}
                  className="text-md text-gray-700 dark:text-gray-300"
                >
                  {enjoyment}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }
};
