import pandas as pd
import numpy as np
from pathlib import Path

np.random.seed(42)

def generate_email_dataset(n_benign=5000, n_phishing=3000, test_split=0.2):
    """Generate synthetic email dataset matching the Email-Security-Pipeline schema."""
    
    # Benign email texts (examples)
    benign_texts = [
        "team meeting scheduled for tomorrow at 2pm in conference room b",
        "project update quarterly results exceeded expectations",
        "reminder your subscription renewal coming next month",
        "thank you for your purchase order confirmation attached",
        "weekly status report sales metrics up by 15 percent",
        "new employee onboarding materials available on the portal",
        "calendar invite department lunch next friday 12pm",
        "budget approval request for q3 marketing campaign",
        "product feature release notes version 2.3 available",
        "customer testimonial project success case study",
    ]
    
    # Phishing email texts (examples)
    phishing_texts = [
        "urgent action required verify your account immediately click link",
        "confirm your identity update password now suspicious activity detected",
        "congratulations you won prize claim reward verify payment method",
        "alert unusual login from unknown location reset password now",
        "paypal account suspended confirm details within 24 hours urgent",
        "bank security alert freeze account click here verify immediately",
        "amazon order problem shipment failed click to resolve quickly",
        "apple id verification required unusual sign in attempt detected",
        "tax refund update reply with ssn for processing immediately",
        "billing problem resolve credit card issue within 2 hours urgent",
    ]
    
    emails = []
    
    # Generate benign emails
    for i in range(n_benign):
        text = np.random.choice(benign_texts)
        urgency = np.random.randint(0, 4)  # Low urgency
        word_count = len(text.split())
        avg_word_length = np.mean([len(w) for w in text.split()])
        emails.append({
            'text_clean': text,
            'urgency_score': urgency,
            'word_count': word_count,
            'avg_word_length': round(avg_word_length, 2),
            'label': 0
        })
    
    # Generate phishing emails
    for i in range(n_phishing):
        text = np.random.choice(phishing_texts)
        urgency = np.random.randint(6, 11)  # High urgency
        word_count = len(text.split())
        avg_word_length = np.mean([len(w) for w in text.split()])
        emails.append({
            'text_clean': text,
            'urgency_score': urgency,
            'word_count': word_count,
            'avg_word_length': round(avg_word_length, 2),
            'label': 1
        })
    
    # Shuffle
    df = pd.DataFrame(emails)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    
    # Train/test split
    split_idx = int(len(df) * (1 - test_split))
    train_df = df[:split_idx]
    test_df = df[split_idx:]
    
    return train_df, test_df

if __name__ == '__main__':
    # Create data directories
    data_dir = Path('data/processed')
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate and save datasets
    print("Generating synthetic email dataset...")
    train_df, test_df = generate_email_dataset()
    
    train_path = data_dir / 'email_train.csv'
    test_path = data_dir / 'email_test.csv'
    
    train_df.to_csv(train_path, index=False)
    test_df.to_csv(test_path, index=False)
    
    print(f"[OK] Training data saved: {train_path} ({len(train_df)} samples)")
    print(f"[OK] Test data saved: {test_path} ({len(test_df)} samples)")
    
    print(f"\nClass distribution (train):")
    print(train_df['label'].value_counts().to_string())
