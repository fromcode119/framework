import { SourcesCollectionRegistry } from '@plugin/src/services/sources-collection-registry';

/**
 * BuildsCollection — tracks build state for each plugin/theme/core source.
 *
 * Stores the last commit SHA, build status, version, and error messages.
 * The combination of slug is globally unique — one build record per extension.
 */
export class BuildsCollection {
  static readonly shortSlug = "builds";
  static readonly slug = SourcesCollectionRegistry.BUILDS;
  static readonly displayName = "Builds";
  static readonly admin = {
    useAsTitle: "slug",
    defaultColumns: ["slug", "type", "version", "last_build_status", "last_build_at"],
    /**
     * Hidden from the navigation: this collection is the Sources screen's STORAGE, and listing it
     * separately gave the sidebar a second "Sources → Builds" section beside the screen that
     * already presents the same rows — two doors into one room, one of them raw.
     */
    hidden: true,
    icon: "Hammer",
  };
  static readonly fields = [
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      label: "Slug",
      admin: { description: "Plugin, theme, or core identifier matching the tracked source." },
    },
    {
      name: "type",
      type: "select",
      required: true,
      label: "Type",
      options: [
        { label: "Plugin", value: "plugin" },
        { label: "Theme", value: "theme" },
        { label: "Core", value: "core" },
      ],
    },
    {
      name: "git_url",
      type: "text",
      required: true,
      label: "Git URL",
      admin: { description: "Repository clone URL." },
    },
    {
      name: "branch",
      type: "text",
      required: true,
      defaultValue: "main",
      label: "Branch",
    },
    {
      name: "git_secret",
      type: "text",
      label: "GitHub Token",
      admin: {
        description: "Optional Personal Access Token for authentication. If empty, uses GITHUB_TOKEN environment variable.",
        hidden: true,
      },
    },
    {
      name: "last_commit_sha",
      type: "text",
      label: "Last Commit SHA",
      admin: { description: "HEAD SHA at time of last successful build." },
    },
    {
      name: "last_build_at",
      type: "datetime",
      label: "Last Build At",
      admin: { readOnly: true },
    },
    {
      name: "last_build_status",
      type: "select",
      defaultValue: "pending",
      label: "Build Status",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Building", value: "building" },
        { label: "Success", value: "success" },
        { label: "Failed", value: "failed" },
      ],
    },
    {
      name: "last_error",
      type: "textarea",
      label: "Last Error",
      admin: { description: "Error message from the most recent failed build." },
    },
    {
      name: "version",
      type: "text",
      label: "Version",
      admin: {
        description: "Semantic version from the last successful build.",
        readOnly: true,
      },
    },
    {
      name: "file_name",
      type: "text",
      label: "File Name",
      admin: {
        description: "Archive filename, e.g. seo-0.1.1.zip.",
        readOnly: true,
      },
    },
    {
      /**
       * Run a build whenever this source's branch moves.
       *
       * Off by default and per source, not global: building is cheap and reversible, but it runs
       * code from a repository, and an operator adding a source they are only watching should not
       * have it compiled behind their back.
       */
      name: "autoBuild",
      type: "boolean",
      defaultValue: false,
      label: "Build automatically",
      admin: { description: "Build this source whenever new commits appear on its branch." },
    },
    {
      /**
       * Install what was built, without asking.
       *
       * A SEPARATE switch from autoBuild because it is a different risk: building produces a file,
       * installing REPLACES running code on a live site. Requires autoBuild — installing something
       * nobody built is not a thing — and stays off unless an operator turns it on deliberately.
       */
      name: "autoUpdate",
      type: "boolean",
      defaultValue: false,
      label: "Install automatically",
      admin: { description: "Install each successful build immediately. Replaces running code without confirmation." },
    },
    {
      /**
       * What changed in the version this source last built.
       *
       * The commit subjects between the previously built SHA and the new one — written by whoever
       * made the change, never generated. Without it "update available: 0.1.5" asks an operator to
       * agree to a number, which is the same complaint the framework's own update screen had.
       */
      name: "changelog",
      type: "textarea",
      label: "What changed",
      admin: { readOnly: true, description: "Commit subjects since the previously built revision." },
    },
    {
      name: "artifactSha256",
      type: "text",
      label: "Artifact SHA-256",
      admin: {
        description:
          "SHA-256 of the built archive FILE, recorded here at build time. This is the only hash of a package that does not travel inside that package, so it is what an installer verifies against before it trusts or executes anything. Written by the build, never by hand.",
        readOnly: true,
      },
    },
  ];
}
