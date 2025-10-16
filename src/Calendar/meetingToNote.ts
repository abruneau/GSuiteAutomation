import { Meeting } from './meeting';

import { extractDomainsFromList } from '../Mail/domain';
import { titleCase } from '../helpers';

export class MeetingNote {
  meeting: Meeting;
  note = '';
  file: GoogleAppsScript.Drive.File | null;
  fileName!: string;

  constructor(meeting: Meeting) {
    this.meeting = meeting;
    this.file = meeting.note();
  }

  private findCompany() {
    return extractDomainsFromList(
      this.meeting.ctx,
      this.meeting.attendees().map(e => e.email)
    )
      .map(d => this.meeting.ctx.ACCOUNTS.get(d)?.name)
      .filter(x => {
        return x !== undefined;
      });
  }

  private formatAttendees(
    displayName: string | undefined,
    email: string | undefined
  ): string {
    if (!displayName || displayName === '') {
      const emailParts = (email ?? '').split('@')[0].split(/[._-]/);
      const firstName = emailParts[0];
      const lastName = emailParts.length > 1 ? emailParts[1] : '';
      displayName = `${firstName} ${lastName}`;
    }
    return `[[${titleCase(displayName)}]] ${email}`;
  }

  private listAttendees(): string[] {
    const attendees =
      this.meeting.event.attendees
        ?.filter(a => !a.self)
        .map(a => this.formatAttendees(a.displayName, a.email)) || [];
    if (!this.meeting.event.organizer?.self) {
      attendees.push(
        this.formatAttendees(
          this.meeting.event.organizer?.displayName,
          this.meeting.event.organizer?.email
        )
      );
    }
    return attendees;
  }

  private createTemplate() {
    const startDate = Utilities.formatDate(
      new Date(this.meeting.event.start?.dateTime ?? ''),
      'CET',
      'yyyy-MM-dd HH:mm'
    );
    const endDate = Utilities.formatDate(
      new Date(this.meeting.event.end?.dateTime ?? ''),
      'CET',
      'yyyy-MM-dd HH:mm'
    );
    const accounts = this.findCompany().map(a => '[[' + a + ']]');
    const guests = this.listAttendees();

    const header = `---\nstart_date: "${startDate}"\nend_date: "${endDate}"\ntags:\n  - meeting\n---`;
    const accountList = `account:: ${accounts.join(',')}`;
    const guestsList = `Attendees:: \n- ${guests?.join('\n- ')}`;
    const oppy = 'oppy:: ';
    const title = `# ${this.meeting.event.summary}`;
    const parts = [header, accountList, oppy, guestsList, title];

    return parts.join('\n\n');
  }

  create(): this {
    this.note = this.createTemplate();
    this.fileName = this.meeting.fileName(
      this.meeting.event.start?.dateTime ?? ''
    );
    return this;
  }

  save() {
    if (this.file) {
      if (this.meeting.ctx.DEBUG) {
        this.meeting.ctx.log.info(`Update note ${this.fileName}`);
        return;
      }
      // If file exists, update it instead of overwriting
      this.update();
      return;
    }
    if (this.meeting.ctx.DEBUG) {
      this.meeting.ctx.log.info(
        `Create note ${this.fileName} \n\n${this.note}`
      );
    } else {
      const dir = DriveApp.getFolderById(this.meeting.ctx.NOTES_FOLDER_ID);
      const files = dir.getFilesByName(this.fileName);
      if (!files.hasNext()) {
        const newFile = dir.createFile(this.fileName, this.note);
        // Store the file ID in event extended properties for future reference
        this.storeNoteId(newFile.getId());
        this.meeting.ctx.log.info(`Create note ${this.fileName}`);
      }
    }
  }

  update() {
    if (!this.file) {
      this.meeting.ctx.log.warn(
        `Cannot update note ${this.fileName} - file not found`
      );
      return;
    }

    if (this.meeting.ctx.DEBUG) {
      this.meeting.ctx.log.info(`Update note ${this.fileName}`);
      return;
    }

    try {
      const existingContent = this.file.getBlob().getDataAsString();
      const updatedContent = this.updateNoteContent(existingContent);

      this.file.setName(this.fileName).setContent(updatedContent);
      this.meeting.ctx.log.info(`Updated note ${this.fileName}`);
    } catch (error) {
      this.meeting.ctx.log.error(
        `Failed to update note ${this.fileName}: ${error}`
      );
    }
  }

  private updateNoteContent(existingContent: string): string {
    const lines = existingContent.split('\n');
    let inFrontmatter = false;
    let frontmatterEndIndex = -1;
    let contentStartIndex = -1;

    // Find frontmatter boundaries
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          frontmatterEndIndex = i;
          contentStartIndex = i + 1;
          break;
        }
      }
    }

    if (frontmatterEndIndex === -1) {
      // No frontmatter found, add frontmatter to existing content
      const newTemplate = this.note;
      const newLines = newTemplate.split('\n');

      // Find the frontmatter in the new template
      let newFrontmatterEndIndex = -1;
      for (let i = 0; i < newLines.length; i++) {
        if (newLines[i].trim() === '---') {
          if (newFrontmatterEndIndex === -1) {
            newFrontmatterEndIndex = i;
          } else {
            newFrontmatterEndIndex = i;
            break;
          }
        }
      }

      // Get the frontmatter and double-colon fields from new template
      const newFrontmatter = newLines.slice(1, newFrontmatterEndIndex);
      const newDoubleColonFields = newLines.slice(newFrontmatterEndIndex + 1);

      // Find where user content starts in existing content (first line starting with #)
      let userContentStartIndex = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('#')) {
          userContentStartIndex = i;
          break;
        }
      }

      if (userContentStartIndex === -1) {
        userContentStartIndex = lines.length;
      }

      const userContentSection = lines.slice(userContentStartIndex);

      // Update double-colon fields in the existing content
      const updatedContentLines = this.updateDoubleColonFields(
        lines,
        newDoubleColonFields
      );

      // Combine frontmatter with updated content
      const result = ['---', ...newFrontmatter, '---', ...updatedContentLines];
      return result.join('\n');
    }

    // Extract existing frontmatter and content
    const frontmatterLines = lines.slice(1, frontmatterEndIndex);
    const contentLines = lines.slice(contentStartIndex);

    // Parse and update frontmatter (only YAML fields)
    const updatedFrontmatter = this.updateFrontmatter(frontmatterLines);

    // Get the new template to extract the double-colon fields
    const newTemplate = this.note;
    const newLines = newTemplate.split('\n');

    // Find the double-colon fields in the new template (after frontmatter)
    let newFrontmatterEndIndex = -1;
    for (let i = 0; i < newLines.length; i++) {
      if (newLines[i].trim() === '---') {
        if (newFrontmatterEndIndex === -1) {
          newFrontmatterEndIndex = i;
        } else {
          newFrontmatterEndIndex = i;
          break;
        }
      }
    }

    const newDoubleColonFields = newLines.slice(newFrontmatterEndIndex + 1);

    // Find and replace double-colon fields in existing content
    const updatedContentLines = this.updateDoubleColonFields(
      contentLines,
      newDoubleColonFields
    );

    // Reconstruct the note
    const result = [
      '---',
      ...updatedFrontmatter,
      '---',
      ...updatedContentLines,
    ];
    return result.join('\n');
  }

  private updateFrontmatter(frontmatterLines: string[]): string[] {
    // Get only the frontmatter part of the new template (between --- markers)
    const newTemplateLines = this.note.split('\n');
    let inFrontmatter = false;
    let frontmatterEndIndex = -1;

    for (let i = 0; i < newTemplateLines.length; i++) {
      if (newTemplateLines[i].trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          frontmatterEndIndex = i;
          break;
        }
      }
    }

    const newFrontmatter = newTemplateLines.slice(1, frontmatterEndIndex);
    const updatedLines: string[] = [];

    // Create a map of new frontmatter fields (only YAML fields, no double colons)
    const newFields = new Map<string, string>();
    for (const line of newFrontmatter) {
      if (line.includes(':') && !line.includes('::')) {
        const [key, ...valueParts] = line.split(':');
        newFields.set(key.trim(), valueParts.join(':').trim());
      }
    }

    // Update existing frontmatter, preserving order and custom fields
    const processedKeys = new Set<string>();
    for (const line of frontmatterLines) {
      if (line.includes(':') && !line.includes('::')) {
        const [key, ...valueParts] = line.split(':');
        const keyTrimmed = key.trim();
        const value = valueParts.join(':').trim();

        if (newFields.has(keyTrimmed)) {
          // Update the field, preserving original formatting
          const newValue = newFields.get(keyTrimmed)!;
          if (line.includes(': ')) {
            // Original had space after colon
            updatedLines.push(`${keyTrimmed}: ${newValue}`);
          } else {
            // Original had no space after colon
            updatedLines.push(`${keyTrimmed}:${newValue}`);
          }
          processedKeys.add(keyTrimmed);
        } else {
          // Keep existing field (like cancelled: true)
          updatedLines.push(line);
        }
      } else {
        updatedLines.push(line);
      }
    }

    // Add any new fields that weren't in the original frontmatter
    for (const [key, value] of newFields) {
      if (!processedKeys.has(key)) {
        updatedLines.push(`${key}: ${value}`);
      }
    }

    return updatedLines;
  }

  private updateDoubleColonFields(
    existingContentLines: string[],
    newDoubleColonFields: string[]
  ): string[] {
    // Extract double-colon fields from new template
    const newFields = new Map<string, string[]>();
    let currentField: string | null = null;
    let currentValue: string[] = [];

    for (const line of newDoubleColonFields) {
      if (line.includes('::')) {
        // Save previous field if exists
        if (currentField) {
          newFields.set(currentField, currentValue);
        }
        // Start new field
        const [key, ...valueParts] = line.split('::');
        currentField = key.trim() + '::';
        currentValue = [valueParts.join('::').trim()];
      } else if (currentField && line.trim() && !line.trim().startsWith('#')) {
        // Continue current field (for multi-line values like Attendees::)
        // But stop if we encounter a title line (starting with #)
        currentValue.push(line);
      } else if (line.trim().startsWith('#')) {
        // Stop parsing when we encounter a title line
        if (currentField) {
          newFields.set(currentField, currentValue);
          currentField = null;
          currentValue = [];
        }
        break;
      }
    }
    // Save last field
    if (currentField) {
      newFields.set(currentField, currentValue);
    }

    // Find the start of user content (first line starting with #)
    let userContentStartIndex = -1;
    for (let i = 0; i < existingContentLines.length; i++) {
      if (existingContentLines[i].trim().startsWith('#')) {
        userContentStartIndex = i;
        break;
      }
    }

    // If no user content found, use the end of the content
    if (userContentStartIndex === -1) {
      userContentStartIndex = existingContentLines.length;
    }

    // Split content into double-colon fields and user content
    const doubleColonSection = existingContentLines.slice(
      0,
      userContentStartIndex
    );
    const userContentSection = existingContentLines.slice(
      userContentStartIndex
    );

    // Update double-colon fields
    const updatedDoubleColonLines: string[] = [];
    const processedKeys = new Set<string>();
    let skipUntilNextField = false;

    for (let i = 0; i < doubleColonSection.length; i++) {
      const line = doubleColonSection[i];

      if (line.includes('::')) {
        const [key, ...valueParts] = line.split('::');
        const keyTrimmed = key.trim() + '::';
        const value = valueParts.join('::').trim();

        if (newFields.has(keyTrimmed)) {
          // Update the field with new value
          const newValue = newFields.get(keyTrimmed)!;
          updatedDoubleColonLines.push(`${keyTrimmed} ${newValue[0]}`);
          // Add remaining lines if any
          for (let j = 1; j < newValue.length; j++) {
            updatedDoubleColonLines.push(newValue[j]);
          }
          processedKeys.add(keyTrimmed);
          skipUntilNextField = true; // Skip old field content until next field
        } else {
          // Keep existing field
          updatedDoubleColonLines.push(line);
          skipUntilNextField = false;
        }
      } else if (skipUntilNextField && line.trim()) {
        // Skip old field content (like old attendees) but keep empty lines
        continue;
      } else {
        // Keep non-double-colon lines (empty lines, etc.)
        updatedDoubleColonLines.push(line);
        skipUntilNextField = false;
      }
    }

    // Add any new double-colon fields that weren't in the original content
    for (const [key, value] of newFields) {
      if (!processedKeys.has(key)) {
        updatedDoubleColonLines.push(`${key} ${value[0]}`);
        for (let j = 1; j < value.length; j++) {
          updatedDoubleColonLines.push(value[j]);
        }
      }
    }

    // Combine updated double-colon fields with user content
    return [...updatedDoubleColonLines, ...userContentSection];
  }

  private storeNoteId(fileId: string) {
    // Store note file ID in event extended properties for reliable tracking
    if (this.meeting.event.extendedProperties?.private) {
      this.meeting.event.extendedProperties.private['note'] = fileId;
    } else {
      this.meeting.event.extendedProperties = {
        private: { note: fileId },
      };
    }
  }

  markAsCancelled() {
    if (!this.file) {
      this.meeting.ctx.log.warn(
        `Cannot mark note as cancelled - file not found: ${this.fileName}`
      );
      return;
    }

    if (this.meeting.ctx.DEBUG) {
      this.meeting.ctx.log.info(`Mark note as cancelled: ${this.fileName}`);
      return;
    }

    try {
      const existingContent = this.file.getBlob().getDataAsString();
      const updatedContent = this.addCancellationMark(existingContent);

      this.file.setContent(updatedContent);
      this.meeting.ctx.log.info(`Marked note as cancelled: ${this.fileName}`);
    } catch (error) {
      this.meeting.ctx.log.error(
        `Failed to mark note as cancelled ${this.fileName}: ${error}`
      );
    }
  }

  private addCancellationMark(existingContent: string): string {
    const lines = existingContent.split('\n');
    let inFrontmatter = false;
    let frontmatterEndIndex = -1;

    // Find frontmatter boundaries
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
        } else {
          frontmatterEndIndex = i;
          break;
        }
      }
    }

    if (frontmatterEndIndex === -1) {
      // No frontmatter found, add it with cancelled status
      const newContent = this.createTemplate();
      const newLines = newContent.split('\n');
      const frontmatterLines = newLines.slice(1, -1); // Remove --- markers
      const updatedFrontmatter = [...frontmatterLines, 'cancelled: true'];
      const contentLines = newLines.slice(-1); // Get content after frontmatter

      return ['---', ...updatedFrontmatter, '---', ...contentLines].join('\n');
    }

    // Check if already marked as cancelled
    const frontmatterLines = lines.slice(1, frontmatterEndIndex);
    const hasCancelled = frontmatterLines.some(line =>
      line.trim().startsWith('cancelled:')
    );

    if (hasCancelled) {
      return existingContent; // Already marked as cancelled
    }

    // Add cancelled field to frontmatter
    const updatedFrontmatter = [...frontmatterLines, 'cancelled: true'];
    const contentLines = lines.slice(frontmatterEndIndex + 1);

    const result = ['---', ...updatedFrontmatter, '---', ...contentLines];

    return result.join('\n');
  }

  delete() {
    if (this.file) {
      if (this.meeting.ctx.DEBUG) {
        this.meeting.ctx.log.info(`Delete note ${this.fileName}`);
      } else {
        this.file.setTrashed(true);
      }
    }
  }
}
