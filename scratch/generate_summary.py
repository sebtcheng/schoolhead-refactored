import csv
import os

def generate_summary():
    dup_csv = 'scratch/duplicate_ipcs.csv'
    media_csv = 'scratch/projects_with_media.csv'
    
    print("--- AUDIT SUMMARY ---\n")
    
    if os.path.exists(dup_csv):
        with open(dup_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)
            ipcs = set(r['IPC'] for r in data)
            print(f"Total Duplicate IPC Groups: {len(ipcs)}")
            print(f"Total Redundant Project Records: {len(data) - len(ipcs)}")
            print("\nExample Duplicate IPCs:")
            for ipc in list(ipcs)[:5]:
                print(f" - {ipc}")
    else:
        print("Duplicate IPC CSV not found.")
        
    print("\n" + "="*40 + "\n")
    
    if os.path.exists(media_csv):
        with open(media_csv, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            data = list(reader)
            photos = sum(1 for r in data if r['Has_Photos'] == 'YES')
            docs = sum(1 for r in data if r['Has_Docs'] == 'YES')
            print(f"Total Projects with Media Submissions: {len(data)}")
            print(f" - Projects with Photos: {photos}")
            print(f" - Projects with Documents: {docs}")
            print("\nExample Projects with Media:")
            for r in data[:5]:
                print(f" - ID: {r['Project_ID']} | IPC: {r['IPC']} | Photos: {r['Has_Photos']} | Docs: {r['Has_Docs']} | {r['School_Name']}")
    else:
        print("Media Submission CSV not found.")

if __name__ == "__main__":
    generate_summary()
