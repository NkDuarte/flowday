import { Routes } from "@angular/router";

export const routes: Routes = [
	{
		path: "",
		pathMatch: "full",
		loadComponent: () => import("./features/day/day.page").then((module) => module.DayPage),
	},
	{ path: "**", redirectTo: "" },
];
